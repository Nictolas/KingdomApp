import type { Abitante, Edificio } from "../types";
import {
  deriveBuildingGeometry,
  edificioHaIngressoPerimetrale,
  celleIngressoSudFootprint,
  NOME_BOSCO
} from "./buildingGeometry";
import { BOSCO_STRISCIA_H } from "./boscoMappa";
import { abitanteHaBisognoMensa } from "./mensaPubblica";
import { abitanteVuoleNegozio } from "./negozio";
import { scegliAzioneTempoLibero } from "./bisogni";
import { getCastaAbitante } from "./casta";
import { disoccupatoIdoneoPerEmporio, emporioHaPostoLibero, trovaEmporioOperativo } from "./emporioLavoro";
import { boscoHaPostoLibero, disoccupatoIdoneoPerBosco } from "./boscoRaccolta";
import {
  disoccupatoIdoneoPerMiniera,
  minieraHaPostoLibero,
  NOME_MINIERA
} from "./minieraRaccolta";
import {
  castelloHaPostoLiberoPerGuardia,
  disoccupatoIdoneoPerGuardia
} from "./castelloGuardie";
import { raccoglitorePuòVendereAllEmporio } from "./emporioVendita";
import {
  fasciaPerEdificio,
  minutiInFascia,
  primoEdificioLavoroOrarioPerAbitante,
  destinazioneLavoroOrarioPerAbitante
} from "./orariLavoroMappa";
import {
  edificioAccettaDisoccupatoCittadino,
  isEdificioImpresa
} from "./edificiLavoro";
import {
  celleIngressoWalkableAttornoAdAnchor,
  orthogonalNeighbors,
  scegliCellaPartenzaWalkable,
  trovaCellaWalkablePiuVicina,
  trovaPercorsoVersoCelle
} from "./mappaPathfinding";

/**
 * Sedi per disoccupati in cerca lavoro, in ordine di priorità.
 * Imprese (non Bosco/Miniera) → Castello → Miniera → Bosco sempre ultima.
 */
export function sediCercaLavoroDisoccupatoInOrdine(
  abitante: Abitante,
  edificiList: Edificio[],
  abitantiTutti?: Abitante[]
): Edificio[] {
  // I Nobili non cercano lavoro (restano «in giro»).
  if (getCastaAbitante(abitante) === "Nobile") return [];
  const impreseConPosto = edificiList
    .filter(
      (e) =>
        isEdificioImpresa(e) &&
        e.nome !== NOME_BOSCO &&
        e.nome !== NOME_MINIERA &&
        e.stato === "Operativo"
    )
    .filter((e) => {
      if (e.nome === "Emporio") {
        return disoccupatoIdoneoPerEmporio(abitante) && emporioHaPostoLibero([e]) != null;
      }
      return edificioAccettaDisoccupatoCittadino(abitante, e, abitantiTutti);
    })
    .sort((a, b) => a.id - b.id);
  const castello = disoccupatoIdoneoPerGuardia(abitante)
    ? castelloHaPostoLiberoPerGuardia(edificiList, abitantiTutti)
    : undefined;
  const miniera = disoccupatoIdoneoPerMiniera(abitante)
    ? minieraHaPostoLibero(edificiList)
    : undefined;
  const bosco = disoccupatoIdoneoPerBosco(abitante) ? boscoHaPostoLibero(edificiList) : undefined;
  return [...impreseConPosto, castello, miniera, bosco].filter((e): e is Edificio => !!e);
}

/** Minimo tipo per celle edificio sulla mappa (come in app/mappa). */
export type EdificioInCellaLike = {
  id: number;
  nome: string;
  edificioGlobaleId?: number;
  footprintRef?: number;
  footprint?: { w: number; h: number };
};

export function getAnchorCellPerEdificio(
  cellIndex: number,
  edificiInMappa: Record<number, EdificioInCellaLike>
): number {
  const e = edificiInMappa[cellIndex];
  if (!e) return cellIndex;
  if (e.footprintRef != null) return e.footprintRef;
  return cellIndex;
}

export function trovaAnchorEdificioGlobaleSuMappa(
  edificioGlobaleId: number,
  edificiInMappa: Record<number, EdificioInCellaLike>
): number | null {
  for (const k of Object.keys(edificiInMappa)) {
    const idx = Number(k);
    const e = edificiInMappa[idx];
    if (!e) continue;
    const anchor = getAnchorCellPerEdificio(idx, edificiInMappa);
    if (anchor !== idx) continue;
    const gid = e.edificioGlobaleId ?? e.id;
    if (gid === edificioGlobaleId) return anchor;
  }
  return null;
}

export function trovaAnchorBarSuMappa(edificiInMappa: Record<number, EdificioInCellaLike>): number | null {
  for (const k of Object.keys(edificiInMappa)) {
    const idx = Number(k);
    const e = edificiInMappa[idx];
    if (!e || e.nome !== "Bar") continue;
    const anchor = getAnchorCellPerEdificio(idx, edificiInMappa);
    if (anchor === idx) return anchor;
  }
  return null;
}

/** Footprint Bosco: dati salvati sul footprint dell’anchor. */
function footprintBoscoSuMappa(
  _anchor: number,
  edificio: EdificioInCellaLike,
  _edificiInMappa: Record<number, EdificioInCellaLike>,
  _cols: number,
  rows: number
): { w: number; h: number } {
  const h = Math.min(edificio.footprint?.h ?? BOSCO_STRISCIA_H, rows);
  const wSaved = edificio.footprint?.w ?? 1;
  return { w: Math.max(1, wSaved), h };
}

/** Tutti gli anchor Bosco (due rettangoli nord). */
export function trovaTuttiAnchorBosco(
  edificiInMappa: Record<number, EdificioInCellaLike>
): number[] {
  const out: number[] = [];
  for (const k of Object.keys(edificiInMappa)) {
    const i = Number(k);
    const e = edificiInMappa[i];
    if (e?.nome === NOME_BOSCO && e.footprintRef == null) out.push(i);
  }
  return out;
}

/** Ingresso sud del Bosco più vicino alla colonna di `fromCell` (davanti a sé, non al centro). */
export function scegliIngressoSudBoscoPiuVicino(
  fromCell: number,
  southEntries: readonly number[],
  cols: number
): number | null {
  if (southEntries.length === 0) return null;
  const fromCol = fromCell % cols;
  let best = southEntries[0]!;
  let bestD = Infinity;
  for (const cell of southEntries) {
    const d = Math.abs((cell % cols) - fromCol);
    if (d < bestD) {
      bestD = d;
      best = cell;
    }
  }
  return best;
}

/** Tutte le celle d’ingresso di un edificio (porta sud, oppure bordo sud per Bosco). */
export function trovaCelleIngressoEdificio(
  anchor: number,
  edificiInMappa: Record<number, EdificioInCellaLike>,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean
): number[] {
  const edificio = edificiInMappa[anchor];
  if (edificio?.nome === NOME_BOSCO || (edificio && edificioHaIngressoPerimetrale(edificio.nome))) {
    const { w, h } = footprintBoscoSuMappa(anchor, edificio, edificiInMappa, cols, rows);
    const sud = celleIngressoSudFootprint(anchor, w, h, cols, rows);
    const walkable = sud.filter(isWalkable);
    return walkable.length > 0 ? walkable : sud;
  }
  const footprint = edificio?.footprint ?? { w: 1, h: 1 };
  const geometry = deriveBuildingGeometry(anchor, footprint.w, footprint.h, cols, rows);
  const entryCell = geometry.entryPoint.cell;
  if (geometry.entryPoint.y < geometry.footprint.row + geometry.footprint.height) return [];
  return isWalkable(entryCell) ? [entryCell] : [];
}

/**
 * Un accesso: porta sud (edifici normali) oppure, per Bosco, una cella del perimetro
 * (preferita quella più vicina a `versoCell` se indicata).
 */
export function trovaCellaPortaEdificio(
  anchor: number,
  edificiInMappa: Record<number, EdificioInCellaLike>,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean,
  versoCell?: number | null
): number | null {
  const cells = trovaCelleIngressoEdificio(anchor, edificiInMappa, cols, rows, isWalkable);
  if (cells.length === 0) return null;
  if (versoCell == null || cells.length === 1) return cells[0]!;
  const vc = versoCell % cols;
  const vr = Math.floor(versoCell / cols);
  let best = cells[0]!;
  let bestDist = Infinity;
  for (const cell of cells) {
    const c = cell % cols;
    const r = Math.floor(cell / cols);
    const d = Math.abs(c - vc) + Math.abs(r - vr);
    if (d < bestDist) {
      bestDist = d;
      best = cell;
    }
  }
  return best;
}

/**
 * Tra i Bar operativi presenti sulla mappa, sceglie quello col percorso più breve dalla cella di partenza.
 * Se `fromCellPreferita` è null, per ogni Bar usa l’anchor del Bar come punto di partenza (stesso criterio della vecchia logica “un solo Bar”).
 */
/**
 * Tra gli edifici operativi con `nome`, sceglie quello col percorso più breve dalla cella di partenza.
 */
export function scegliEdificioIdPiuVicinoPerNome(
  nome: string,
  fromCellPreferita: number | null,
  edificiList: Edificio[],
  edificiInMappa: Record<number, EdificioInCellaLike>,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean
): number | null {
  const candidati = edificiList.filter((e) => e.nome === nome && e.stato === "Operativo");
  if (candidati.length === 0) return null;
  let bestId: number | null = null;
  let bestLen = Infinity;
  for (const e of candidati) {
    const anchor = trovaAnchorEdificioGlobaleSuMappa(e.id, edificiInMappa);
    if (anchor == null) continue;
    const from = fromCellPreferita ?? anchor;
    const path = calcolaPercorsoVersoAnchorEdificio(from, anchor, cols, rows, isWalkable, edificiInMappa);
    if (path == null) continue;
    if (path.length < bestLen) {
      bestLen = path.length;
      bestId = e.id;
    }
  }
  return bestId;
}

export function scegliBarEdificioIdPiuVicino(
  fromCellPreferita: number | null,
  edificiList: Edificio[],
  edificiInMappa: Record<number, EdificioInCellaLike>,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean
): number | null {
  return scegliEdificioIdPiuVicinoPerNome(
    "Bar",
    fromCellPreferita,
    edificiList,
    edificiInMappa,
    cols,
    rows,
    isWalkable
  );
}

export function scegliLuogoCultoEdificioIdPiuVicino(
  nomeLuogoCulto: string,
  fromCellPreferita: number | null,
  edificiList: Edificio[],
  edificiInMappa: Record<number, EdificioInCellaLike>,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean
): number | null {
  return scegliEdificioIdPiuVicinoPerNome(
    nomeLuogoCulto,
    fromCellPreferita,
    edificiList,
    edificiInMappa,
    cols,
    rows,
    isWalkable
  );
}

export function scegliMensaEdificioIdPiuVicino(
  fromCellPreferita: number | null,
  edificiList: Edificio[],
  edificiInMappa: Record<number, EdificioInCellaLike>,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean
): number | null {
  return scegliEdificioIdPiuVicinoPerNome(
    "Mensa Pubblica",
    fromCellPreferita,
    edificiList,
    edificiInMappa,
    cols,
    rows,
    isWalkable
  );
}

export function calcolaPercorsoVersoAnchorEdificio(
  fromCellPreferita: number,
  anchorDest: number,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean,
  edificiInMappa?: Record<number, EdificioInCellaLike>
): number[] | null {
  const destNome = edificiInMappa?.[anchorDest]?.nome;
  const èBosco = destNome === NOME_BOSCO;

  const goals = new Set<number>();
  if (edificiInMappa) {
    if (èBosco) {
      // Tutti gli ingressi sud di entrambi i rettangoli Bosco; meta = colonna più vicina.
      const anchors = trovaTuttiAnchorBosco(edificiInMappa);
      const sud: number[] = [];
      for (const a of anchors.length > 0 ? anchors : [anchorDest]) {
        for (const cell of trovaCelleIngressoEdificio(a, edificiInMappa, cols, rows, () => true)) {
          sud.push(cell);
        }
      }
      const nearest = scegliIngressoSudBoscoPiuVicino(fromCellPreferita, sud, cols);
      if (nearest != null) goals.add(nearest);
    } else {
      for (const cell of trovaCelleIngressoEdificio(anchorDest, edificiInMappa, cols, rows, isWalkable)) {
        goals.add(cell);
      }
    }
  } else {
    for (const cell of celleIngressoWalkableAttornoAdAnchor(anchorDest, cols, rows, isWalkable)) goals.add(cell);
  }
  if (goals.size === 0 && !edificiInMappa) {
    const nb = orthogonalNeighbors(anchorDest, cols, rows).filter(isWalkable);
    for (const n of nb) goals.add(n);
  }
  if (goals.size === 0) return null;

  let start: number | null = null;
  const parteDaEdificio = !!(
    edificiInMappa && !isWalkable(fromCellPreferita) && edificiInMappa[fromCellPreferita]
  );
  if (edificiInMappa && parteDaEdificio) {
    const sourceAnchor = getAnchorCellPerEdificio(fromCellPreferita, edificiInMappa);
    const sampleGoal = goals.values().next().value as number | undefined;
    start = trovaCellaPortaEdificio(
      sourceAnchor,
      edificiInMappa,
      cols,
      rows,
      isWalkable,
      sampleGoal ?? fromCellPreferita
    );
  } else {
    const sample = goals.values().next().value as number | undefined;
    start = scegliCellaPartenzaWalkable(
      fromCellPreferita,
      sample ?? anchorDest,
      cols,
      rows,
      isWalkable
    );
  }
  if (parteDaEdificio && start == null) return null;
  if (start == null || !isWalkable(start)) {
    start =
      trovaCellaWalkablePiuVicina(fromCellPreferita, cols, rows, isWalkable) ??
      (isWalkable(fromCellPreferita) ? fromCellPreferita : null);
  }
  if (start == null || !isWalkable(start)) return null;

  // Bosco: la cella d’ingresso scelta resta raggiungibile anche con decorazione sopra.
  const goalUnica = èBosco ? ([...goals][0] ?? null) : null;
  const walk =
    goalUnica != null ? (i: number) => i === goalUnica || isWalkable(i) : isWalkable;

  return trovaPercorsoVersoCelle(start, goals, cols, rows, walk);
}

export function pianificaCommuteVersoBarDaCella(
  fromCellPreferita: number,
  edificioBarGlobaleId: number,
  edificiInMappa: Record<number, EdificioInCellaLike>,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean
): number[] | null {
  const bAnchor = trovaAnchorEdificioGlobaleSuMappa(edificioBarGlobaleId, edificiInMappa);
  if (bAnchor == null) return null;
  return calcolaPercorsoVersoAnchorEdificio(fromCellPreferita, bAnchor, cols, rows, isWalkable, edificiInMappa);
}

export function pianificaCommuteVersoEdificioGlobaleDaCella(
  fromCellPreferita: number,
  edificioGlobaleId: number,
  edificiInMappa: Record<number, EdificioInCellaLike>,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean
): number[] | null {
  const wAnchor = trovaAnchorEdificioGlobaleSuMappa(edificioGlobaleId, edificiInMappa);
  if (wAnchor == null) return null;
  return calcolaPercorsoVersoAnchorEdificio(fromCellPreferita, wAnchor, cols, rows, isWalkable, edificiInMappa);
}

export type RisultatoCommuteMattina = {
  path: number[] | null;
  purpose?: "work" | "bar" | "mensa" | "home" | "negozio" | "rapina" | "cerca_lavoro" | "vende_emporio";
  barEdificioId?: number;
  mensaEdificioId?: number;
  negozioEdificioId?: number;
  lavoroCercaEdificioId?: number;
  lavoroEdificioId?: number;
  emporioVenditaEdificioId?: number;
};

/**
 * All’alba / tempo libero: priorità da bisogni (mensa/negozio → bar → casa), poi lavoro se in fascia.
 */
export function pianificaCommuteMattina(
  abitante: Abitante,
  homeAnchor: number | null,
  ultimaCellaNota: number | null,
  edificiList: Edificio[],
  edificiInMappa: Record<number, EdificioInCellaLike>,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean,
  minutiDaMezzanotte: number,
  optsExtra?: { puòRapinare?: boolean; abitantiTutti?: Abitante[] }
): RisultatoCommuteMattina {
  if (abitante.razza === "Golem") return { path: null };

  const fromBase = homeAnchor ?? ultimaCellaNota;
  const haCasa = homeAnchor != null;
  const puòMensa = abitanteHaBisognoMensa(abitante, edificiList);
  const puòNegozio = abitanteVuoleNegozio(abitante, edificiList);
  const abitantiTutti = optsExtra?.abitantiTutti ?? [abitante];
  const azioneLibera = scegliAzioneTempoLibero(abitante, {
    puòUsareMensa: puòMensa,
    puòUsareNegozio: puòNegozio,
    puòRapinare: optsExtra?.puòRapinare === true,
    haCasa
  });

  const pathVersoMensa = (): RisultatoCommuteMattina => {
    const mensaId = scegliMensaEdificioIdPiuVicino(fromBase, edificiList, edificiInMappa, cols, rows, isWalkable);
    if (mensaId == null) return { path: null };
    const mAnchor = trovaAnchorEdificioGlobaleSuMappa(mensaId, edificiInMappa);
    if (mAnchor == null) return { path: null };
    const from = fromBase ?? mAnchor;
    const path = calcolaPercorsoVersoAnchorEdificio(from, mAnchor, cols, rows, isWalkable, edificiInMappa);
    return path != null ? { path, purpose: "mensa", mensaEdificioId: mensaId } : { path: null };
  };

  const pathVersoNegozio = (): RisultatoCommuteMattina => {
    const negozioId = scegliEdificioIdPiuVicinoPerNome(
      "Negozio",
      fromBase,
      edificiList,
      edificiInMappa,
      cols,
      rows,
      isWalkable
    );
    if (negozioId == null) return { path: null };
    const nAnchor = trovaAnchorEdificioGlobaleSuMappa(negozioId, edificiInMappa);
    if (nAnchor == null) return { path: null };
    const from = fromBase ?? nAnchor;
    const path = calcolaPercorsoVersoAnchorEdificio(from, nAnchor, cols, rows, isWalkable, edificiInMappa);
    return path != null ? { path, purpose: "negozio", negozioEdificioId: negozioId } : { path: null };
  };

  const pathVersoBar = (): RisultatoCommuteMattina => {
    const barId = scegliBarEdificioIdPiuVicino(fromBase, edificiList, edificiInMappa, cols, rows, isWalkable);
    if (barId == null) return { path: null };
    const bAnchor = trovaAnchorEdificioGlobaleSuMappa(barId, edificiInMappa);
    if (bAnchor == null) return { path: null };
    const from = fromBase ?? bAnchor;
    const path = calcolaPercorsoVersoAnchorEdificio(from, bAnchor, cols, rows, isWalkable, edificiInMappa);
    return path != null ? { path, purpose: "bar", barEdificioId: barId } : { path: null };
  };

  const pathVersoCasa = (): RisultatoCommuteMattina => {
    if (homeAnchor == null) return { path: null };
    const from = fromBase ?? homeAnchor;
    if (from === homeAnchor) return { path: null };
    const path = calcolaPercorsoVersoAnchorEdificio(from, homeAnchor, cols, rows, isWalkable, edificiInMappa);
    return path != null ? { path, purpose: "home" } : { path: null };
  };

  const pathVersoLavoro = (): RisultatoCommuteMattina => {
    const lavoro = destinazioneLavoroOrarioPerAbitante(abitante.id, edificiList, abitantiTutti);
    if (!lavoro) return { path: null };
    const wAnchor = trovaAnchorEdificioGlobaleSuMappa(lavoro.id, edificiInMappa);
    if (wAnchor == null) return { path: null };
    const from = fromBase ?? wAnchor;
    const path = calcolaPercorsoVersoAnchorEdificio(from, wAnchor, cols, rows, isWalkable, edificiInMappa);
    return path != null ? { path, purpose: "work", lavoroEdificioId: lavoro.id } : { path: null };
  };

  const pathVersoVendeEmporio = (): RisultatoCommuteMattina => {
    if (!raccoglitorePuòVendereAllEmporio(abitante, edificiList, abitantiTutti)) {
      return { path: null };
    }
    const emporio = trovaEmporioOperativo(edificiList);
    if (!emporio) return { path: null };
    const anchor = trovaAnchorEdificioGlobaleSuMappa(emporio.id, edificiInMappa);
    if (anchor == null) return { path: null };
    const from = fromBase ?? anchor;
    const path = calcolaPercorsoVersoAnchorEdificio(from, anchor, cols, rows, isWalkable, edificiInMappa);
    return path != null
      ? { path, purpose: "vende_emporio", emporioVenditaEdificioId: emporio.id }
      : { path: null };
  };

  const pathVersoCercaLavoro = (): RisultatoCommuteMattina => {
    const candidati = sediCercaLavoroDisoccupatoInOrdine(abitante, edificiList, abitantiTutti);
    if (candidati.length === 0) return { path: null };
    for (const edificio of candidati) {
      const anchor = trovaAnchorEdificioGlobaleSuMappa(edificio.id, edificiInMappa);
      if (anchor == null) continue;
      const from = fromBase ?? anchor;
      const path = calcolaPercorsoVersoAnchorEdificio(from, anchor, cols, rows, isWalkable, edificiInMappa);
      if (path == null || path.length < 2) continue;
      return { path, purpose: "cerca_lavoro", lavoroCercaEdificioId: edificio.id };
    }
    return { path: null };
  };

  const provaAzioneLibera = (): RisultatoCommuteMattina => {
    if (azioneLibera === "mensa") {
      const m = pathVersoMensa();
      if (m.path != null && m.path.length >= 2) return m;
    }
    if (azioneLibera === "negozio") {
      const n = pathVersoNegozio();
      if (n.path != null && n.path.length >= 2) return n;
    }
    // Rapina: path scelto dallo scheduler mappa (serve bersaglio dinamico).
    if (azioneLibera === "rapina") return { path: null, purpose: "rapina" };
    if (azioneLibera === "bar") {
      const b = pathVersoBar();
      if (b.path != null && b.path.length >= 2) return b;
    }
    if (azioneLibera === "home") {
      const h = pathVersoCasa();
      if (h.path != null && h.path.length >= 2) return h;
    }
    return { path: null };
  };

  const lavoro = primoEdificioLavoroOrarioPerAbitante(abitante.id, edificiList, abitantiTutti);
  if (lavoro) {
    const fascia = fasciaPerEdificio(lavoro);
    if (fascia && minutiInFascia(minutiDaMezzanotte, fascia)) {
      if (azioneLibera === "mensa" && puòMensa) {
        const m = pathVersoMensa();
        if (m.path != null && m.path.length >= 2) return m;
      }
      if (azioneLibera === "negozio" && puòNegozio) {
        const n = pathVersoNegozio();
        if (n.path != null && n.path.length >= 2) return n;
      }
      // Fame critica → rapina: non forzare il lavoro (lo scheduler mappa avvia il furto).
      if (azioneLibera === "rapina") return { path: null, purpose: "rapina" };
      const w = pathVersoLavoro();
      if (w.path != null && w.path.length >= 2) return w;
      if (w.path != null && w.path.length >= 1) return w; // già all’ingresso
      // Lavoro in fascia ma irraggiungibile: non dirottare su bar/casa (la mappa ricolloca).
      return {
        path: null,
        purpose: "work",
        lavoroEdificioId:
          destinazioneLavoroOrarioPerAbitante(abitante.id, edificiList, abitantiTutti)?.id ??
          lavoro.id
      };
    }
  }

  // Fame critica: prima cibo/rapina, poi vendita eccedenze, poi cerca lavoro.
  if (azioneLibera === "mensa" || azioneLibera === "negozio" || azioneLibera === "rapina") {
    const urgente = provaAzioneLibera();
    if (urgente.path != null && urgente.path.length >= 2) return urgente;
    if (urgente.purpose === "rapina") return urgente;
  }

  // Fuori orario lavoro: Raccoglitore/Agricoltore con eccedenza cibo → Emporio.
  const vendita = pathVersoVendeEmporio();
  if (vendita.path != null && vendita.path.length >= 2) return vendita;

  const cerca = pathVersoCercaLavoro();
  if (cerca.path != null && cerca.path.length >= 2) return cerca;

  const libera = provaAzioneLibera();
  if (libera.path != null && libera.path.length >= 2) return libera;

  return { path: null };
}

export function pianificaCommuteSeraACasa(
  homeAnchor: number,
  fromCell: number,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean,
  edificiInMappa?: Record<number, EdificioInCellaLike>
): number[] | null {
  return calcolaPercorsoVersoAnchorEdificio(fromCell, homeAnchor, cols, rows, isWalkable, edificiInMappa);
}

/**
 * Path di uscita dal Castello: parte dalla porta (entry), poi qualche passo su terra walkable.
 * Garantisce almeno 2 celle quando c’è un vicino walkable (Phaser richiede length ≥ 2 per animare).
 */
export function pianificaUscitaDalCastello(
  castelloAnchor: number,
  edificiInMappa: Record<number, EdificioInCellaLike>,
  cols: number,
  rows: number,
  isWalkable: (i: number) => boolean
): number[] | null {
  const porta = trovaCellaPortaEdificio(castelloAnchor, edificiInMappa, cols, rows, isWalkable);
  if (porta == null) return null;
  const path: number[] = [porta];
  let cur = porta;
  for (let step = 0; step < 4; step++) {
    const col = cur % cols;
    const neighbors = [cur + cols, cur - cols, col > 0 ? cur - 1 : -1, col < cols - 1 ? cur + 1 : -1].filter(
      (n) => n >= 0 && n < cols * rows && isWalkable(n) && !path.includes(n)
    );
    if (neighbors.length === 0) break;
    // Preferisci andare verso sud (lontano dal Castello).
    neighbors.sort((a, b) => Math.floor(b / cols) - Math.floor(a / cols));
    cur = neighbors[0]!;
    path.push(cur);
  }
  return path;
}
