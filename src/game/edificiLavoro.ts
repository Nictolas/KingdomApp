import type { Abitante, Edificio } from "../types";
import { edificiData } from "../data/edificiData";
import { EDIFICIO_COMPETENZA_RICHIESTA, type CompetenzaEdificio } from "../data/edificiCompetenze";
import { èImpresa } from "../data/impreseCatalogo";
import { getCastaAbitante } from "./casta";
import { assicuraLavoroClero, haCastaCleroEsplicita, èLavoroClero } from "./clero";
import { abitanteCercaLavoroPerSoldi, abitanteVuolePrendereLavoro } from "./bisogni";
import { getMoneteInventarioAbitante } from "./inventario";
import {
  CAPACITA_GUARDIE_CASTELLO,
  idsResidentiFissiCastello,
  LAVORO_GUARDIA,
  postiLiberiGuardieCastello
} from "./castelloGuardie";
import { LAVORO_CONSIGLIERE } from "./consigliere";
import { ID_GIOCATORE, isGiocatore, LAVORO_GIOCATORE, puoEssereAssegnatoForzatamente } from "./schiavituCommercio";

/** Occupazioni rimosse (fantascienza / obsolete). */
export const OCCUPAZIONI_RIMOSSE = new Set([
  "Ingegnere",
  "Meccanico",
  "Comunicatore",
  "Amministratore",
  "Tecnico",
  "Operatore"
]);

/** Mappa edificioId → nome lavoro. Usata per sincronizzare lavoro abitante e per auto-assign a fine mese. */
export const EDIFICIO_TO_LAVORO: Record<number, string> = {
  1: LAVORO_GUARDIA,  // Castello (Guardie; il Re resta LAVORO_GIOCATORE via isGiocatore)
  2: "Agricoltore",     // Serra
  21: "Agricoltore",    // Serra (seconda unità)
  3: "Minatore",        // Miniera
  5: "Ricercatore",     // Laboratorio di Ricerca
  7: "Medico",          // Ospedale
  11: "Maestro",         // Scuola
  12: "Giudice",        // Tribunale
  13: "Edile",          // Impianto di Riciclo
  15: "Fabbro",         // Acquedotto
  16: "Sicurezza",      // Caserma
  17: "Barista",        // Bar
  18: "Sicurezza",      // Centrale (polizia)
  22: "Funzionario",     // Ufficio Immigrazione
  23: "Commerciante",    // Mercato
  24: "Insegnante",      // Asilo
  25: "Insegnante",      // Scuola Elementare
  26: "Insegnante",      // Scuola Superiore
  27: "Insegnante",      // Università
  28: "Commerciante",    // Negozio
  29: "Cuoco",             // Mensa Pubblica
  30: "Religioso",          // Luogo di Culto del Sole
  31: "Religioso",          // Luogo di Culto delle Ombre
  33: "Edile",              // Ufficio Edile
  34: "Fabbro",             // Fucina
  35: "Mercante",           // Emporio
  36: "Falegname",          // Falegnameria
  37: "Conciatore",         // Conceria
  38: "Fornaio",            // Forno
  39: "Ceraiolo",           // Cereria
  40: "Sarto",              // Sartoria
  41: "Birraio",            // Birrificio
  42: "Oste",               // Taverna
  43: "Speziale",           // Spezieria
  44: "Armaiolo",           // Armeria
  45: "Fabbro",             // Forgia
  46: "Sacerdote",          // Chiesa
  47: "Medico della Peste", // Lazzaretto
  48: "Scriba",             // Scriptorium
  49: "Alchimista",         // Laboratorio Magico
  50: "Necromante",         // Cripta Necromantica
  51: "Raccoglitore",       // Bosco
  52: "Monetiere"          // Zecca
};

const LAVORI_DA_EDIFICIO = new Set(Object.values(EDIFICIO_TO_LAVORO));

/** Un Tribunale offre esattamente un posto di Giudice, anche nei vecchi salvataggi. */
export function capienzaPostiLavoro(edificio: Edificio): number {
  return edificio.nome === "Tribunale" ? 1 : (edificio.capacità ?? 0);
}

/** Conserva un solo Giudice per ogni Tribunale, senza toccare altri edifici.
 * Preferisce chi esercita già il lavoro; i rimanenti sono ricollocabili.
 */
export function normalizzaGiudiciTribunale(abitanti: Abitante[], edifici: Edificio[]): Edificio[] {
  const byId = new Map(abitanti.map(a => [a.id, a]));
  const giàAssegnati = new Set<number>();
  let changed = false;
  const result = edifici.map(e => {
    if (e.nome !== "Tribunale") return e;
    const candidati = [...new Set(e.abitantiAssegnati ?? [])]
      .filter(id => !giàAssegnati.has(id))
      .filter(id => {
        const a = byId.get(id);
        return a && !isGiocatore(a) && a.lavoro !== "Pensionato" && a.lavoro !== "Prigioniero";
      });
    const occupante = candidati.find(id => byId.get(id)?.lavoro === "Giudice") ?? candidati[0];
    const ids = occupante == null ? [] : [occupante];
    if (occupante != null) giàAssegnati.add(occupante);
    if (e.capacità === 1 && e.occupazione === ids.length &&
        (e.abitantiAssegnati ?? []).length === ids.length &&
        (e.abitantiAssegnati ?? []).every((id, i) => id === ids[i])) return e;
    changed = true;
    return { ...e, capacità: 1, abitantiAssegnati: ids, occupazione: ids.length };
  });
  return changed ? result : edifici;
}

const EDIFICI_PUBBLICI_ESCLUSI = new Set(["Campo di Lavoro", "Campo di Sterminio"]);

/** True se l’edificio è un’Impresa (scheda Impresa; payroll può essere cassa o Tesoro). */
export function isEdificioImpresa(edificio: Edificio): boolean {
  // Miniera: scheda tipo Bosco, ma stipendi dal Tesoro (risorsa reale).
  if (edificio.nome === "Miniera") return false;
  return edificio.categoriaEconomica === "Impresa" || èImpresa(edificio.nome);
}

/** Edificio pubblico con postazioni lavoro (stipendi pagati dal tesoro del giocatore). */
export function isEdificioPubblicoConPostazioniLavoro(edificio: Edificio): boolean {
  if (edificio.stato !== "Operativo") return false;
  if (edificio.tipo === "Residenza") return false;
  if (EDIFICI_PUBBLICI_ESCLUSI.has(edificio.nome)) return false;
  // Miniera / Serra: scheda Impresa, ma stipendi dal Tesoro (produzione per il regno).
  if (edificio.nome === "Miniera" || edificio.nome === "Serra") {
    return (edificio.capacità ?? 0) > 0;
  }
  if (isEdificioImpresa(edificio)) return false;
  const cap = edificio.capacità ?? 0;
  if (cap <= 0) return false;
  return (
    getLavoroPerEdificio(edificio) != null ||
    getCompetenzaMinimaPerEdificio(edificio) != null ||
    edificio.tipo === "Luogo di Culto"
  );
}

function assegnaDisoccupatiAEdificiPubblici(
  candidati: Abitante[],
  edifici: Edificio[],
  tuttiAbitanti?: Abitante[]
): Edificio[] {
  const assigned = new Set<number>();
  const edificiOut = edifici.map((e) => ({ ...e, abitantiAssegnati: [...(e.abitantiAssegnati ?? [])] }));
  const perConsigliere = tuttiAbitanti ?? candidati;

  const conReq = edificiOut
    .filter(
      (e) =>
        isEdificioPubblicoConPostazioniLavoro(e) &&
        e.nome !== "Miniera" &&
        e.nome !== "Serra"
    )
    .map((edificio) => ({
      edificio,
      req: getCompetenzaMinimaPerEdificio(edificio) ?? {
        competenzaMinima: 0,
        nomeCompetenza: "Competenza Generale"
      }
    }))
    // Posti entry-level prima (Bar, Negozio, Serra…), così i disoccupati non finiscono tutti in edifici «difficili» assenti dalla mappa.
    .sort((a, b) => {
      if (a.req.competenzaMinima !== b.req.competenzaMinima) {
        return a.req.competenzaMinima - b.req.competenzaMinima;
      }
      return a.edificio.id - b.edificio.id;
    });

  for (const { edificio, req } of conReq) {
    const slotLiberi =
      edificio.nome === "Castello"
        ? postiLiberiGuardieCastello(edificio, ID_GIOCATORE, perConsigliere)
        : capienzaPostiLavoro(edificio) - edificio.abitantiAssegnati!.length;
    if (slotLiberi <= 0) continue;

    let aggiunti = 0;
    for (const a of candidati) {
      if (aggiunti >= slotLiberi) break;
      if (assigned.has(a.id)) continue;
      if (a.competenza < req.competenzaMinima) continue;
      edificio.abitantiAssegnati!.push(a.id);
      edificio.occupazione = edificio.abitantiAssegnati!.length;
      assigned.add(a.id);
      aggiunti++;
    }
  }

  return edificiOut;
}

/** Cittadini disoccupati: solo Emporio (max 4 Mercanti). Priorità a chi ha pochi soldi. */
export function autoAssegnaCittadiniDisoccupati(abitanti: Abitante[], edifici: Edificio[]): Edificio[] {
  const candidati = abitanti
    .filter((a) => {
      if (isGiocatore(a)) return false;
      if (!abitanteVuolePrendereLavoro(a)) return false;
      if (a.lavoro === "Pensionato" || a.lavoro === "Prigioniero") return false;
      if (a.razza === "Golem") return false;
      return getCastaAbitante(a) === "Cittadino";
    })
    .sort((a, b) => {
      const moneteA = getMoneteInventarioAbitante(a.inventario);
      const moneteB = getMoneteInventarioAbitante(b.inventario);
      const urgeA = abitanteCercaLavoroPerSoldi(a, moneteA) ? 1 : 0;
      const urgeB = abitanteCercaLavoroPerSoldi(b, moneteB) ? 1 : 0;
      if (urgeB !== urgeA) return urgeB - urgeA;
      if (moneteA !== moneteB) return moneteA - moneteB;
      return b.competenza - a.competenza;
    });
  const emporio = edifici.find((e) => e.nome === "Emporio" && e.stato === "Operativo");
  if (!emporio) return edifici;
  const già = new Set(emporio.abitantiAssegnati ?? []);
  const cap = Math.min(emporio.capacità ?? 4, 4);
  const posti = Math.max(0, cap - già.size);
  if (posti <= 0) return edifici;
  const minComp = getCompetenzaMinimaPerEdificio(emporio)?.competenzaMinima ?? 0;
  const daAggiungere: number[] = [];
  for (const a of candidati) {
    if (daAggiungere.length >= posti) break;
    if (già.has(a.id)) continue;
    if (a.competenza < minComp) continue;
    daAggiungere.push(a.id);
  }
  if (daAggiungere.length === 0) return edifici;
  const ids = [...(emporio.abitantiAssegnati ?? []), ...daAggiungere];
  return edifici.map((e) =>
    e.id === emporio.id ? { ...e, abitantiAssegnati: ids, occupazione: ids.length } : e
  );
}

/** Cittadini e Servi della gleba disoccupati possono ottenere impieghi idonei. */
export function edificioAccettaDisoccupatoCittadino(
  abitante: Abitante,
  edificio: Edificio,
  tuttiAbitanti?: Abitante[]
): boolean {
  if (isGiocatore(abitante)) return false;
  if (!abitanteVuolePrendereLavoro(abitante)) return false;
  if (abitante.razza === "Golem") return false;
  if (getCastaAbitante(abitante) !== "Cittadino" && getCastaAbitante(abitante) !== "Servo della gleba") return false;
  // Miniera/Bosco: assunzione speciale tramite mappa.
  if (edificio.nome === "Miniera" || edificio.nome === "Bosco") return false;
  const accettato =
    isEdificioPubblicoConPostazioniLavoro(edificio) ||
    (isEdificioImpresa(edificio) && edificio.stato === "Operativo");
  if (!accettato) return false;
  const assegnati = edificio.abitantiAssegnati ?? [];
  if (assegnati.includes(abitante.id)) return false;
  const postiLiberi =
    edificio.nome === "Castello"
      ? postiLiberiGuardieCastello(edificio, ID_GIOCATORE, tuttiAbitanti)
      : capienzaPostiLavoro(edificio) - assegnati.length;
  if (postiLiberi <= 0) return false;
  const req = getCompetenzaMinimaPerEdificio(edificio);
  const min = req?.competenzaMinima ?? 0;
  return abitante.competenza >= min;
}

/** Edifici pubblici con posto libero per cui il disoccupato cittadino è idoneo. */
export function elencoEdificiConPostoPerDisoccupato(
  abitante: Abitante,
  edifici: Edificio[],
  tuttiAbitanti?: Abitante[]
): Edificio[] {
  return edifici
    .filter((e) => edificioAccettaDisoccupatoCittadino(abitante, e, tuttiAbitanti))
    .sort((a, b) => a.id - b.id);
}

/**
 * Assume un Cittadino o Servo della gleba quando raggiunge l'impiego.
 */
export function assumiCittadinoDisoccupatoInEdificio(
  abitanti: Abitante[],
  edifici: Edificio[],
  abitanteId: number,
  edificioId: number
): { abitanti: Abitante[]; edifici: Edificio[]; ok: boolean } {
  const ab = abitanti.find((a) => a.id === abitanteId);
  const ed = edifici.find((e) => e.id === edificioId);
  if (!ab || !ed || !edificioAccettaDisoccupatoCittadino(ab, ed, abitanti)) {
    return { abitanti, edifici, ok: false };
  }
  const edificiNext = edifici.map((e) => {
    if (e.id !== edificioId) return e;
    const ids = [...(e.abitantiAssegnati ?? []), abitanteId];
    return { ...e, abitantiAssegnati: ids, occupazione: ids.length };
  });
  const lavoro = getLavoroPerEdificio(ed);
  const abitantiNext = lavoro
    ? abitanti.map((a) => (a.id === abitanteId ? { ...a, lavoro } : a))
    : abitanti;
  return { abitanti: abitantiNext, edifici: edificiNext, ok: true };
}

/** Edifici in cui il giocatore può assegnare manualmente Servi della gleba (include Serra e Bar). */
const NOMI_EDIFICIO_SERVI_DELLA_GLEBA: Set<string> = (() => {
  const nomi = new Set<string>(["Serra", "Bar"]);
  for (const idStr of Object.keys(EDIFICIO_TO_LAVORO)) {
    const tpl = edificiData.find((e) => e.id === Number(idStr));
    if (tpl) nomi.add(tpl.nome);
  }
  return nomi;
})();

export function edificioAccettaServiDellaGleba(edificio: Edificio): boolean {
  if (edificio.stato !== "Operativo") return false;
  return NOMI_EDIFICIO_SERVI_DELLA_GLEBA.has(edificio.nome);
}

/** Lavoro associato a un edificio (istanza): lookup per id catalogo o per nome del template). */
export function getLavoroPerEdificio(edificio: Edificio): string | undefined {
  const direct = EDIFICIO_TO_LAVORO[edificio.id];
  if (direct) return direct;
  const template = edificiData.find((t) => t.nome === edificio.nome);
  return template ? EDIFICIO_TO_LAVORO[template.id] : undefined;
}

/**
 * Servi della gleba assegnabili a un posto di lavoro dal giocatore.
 * Richiede disoccupazione effettiva, indipendentemente dalla residenza.
 */
export function getServiDellaGlebaAssegnabili(abitanti: Abitante[], edifici: Edificio[]): Abitante[] {
  const giàAssegnatiLavoro = new Set<number>();
  edifici.forEach((e) => {
    if (getLavoroPerEdificio(e) == null) return;
    (e.abitantiAssegnati ?? []).forEach((id) => giàAssegnatiLavoro.add(id));
  });

  return abitanti.filter((a) => {
    if (getCastaAbitante(a) !== "Servo della gleba") return false;
    if (a.lavoro !== "Disoccupato" || a.razza === "Golem") return false;
    if (giàAssegnatiLavoro.has(a.id)) return false;
    return true;
  });
}

/** Servi della gleba che il giocatore può assegnare a un edificio-lavoro con posti liberi. */
export function getServiDellaGlebaPerAssegnazioneEdificio(
  abitanti: Abitante[],
  edifici: Edificio[],
  edificio: Edificio
): Abitante[] {
  if (!edificioAccettaServiDellaGleba(edificio)) return [];
  const postiLiberi =
    edificio.nome === "Castello"
      ? postiLiberiGuardieCastello(edificio, ID_GIOCATORE, abitanti)
      : capienzaPostiLavoro(edificio) - (edificio.abitantiAssegnati ?? []).length;
  if (postiLiberi <= 0) return [];
  return getServiDellaGlebaAssegnabili(abitanti, edifici);
}

/** Competenza richiesta per auto-assign (istanze con id nuovo → stesso nome del catalogo). */
export function getCompetenzaMinimaPerEdificio(edificio: Edificio): CompetenzaEdificio | undefined {
  const direct = EDIFICIO_COMPETENZA_RICHIESTA[edificio.id];
  if (direct) return direct;
  const template = edificiData.find((t) => t.nome === edificio.nome);
  return template ? EDIFICIO_COMPETENZA_RICHIESTA[template.id] : undefined;
}

export type PostazioneLavoroRiga = {
  edificioId: number;
  nome: string;
  emoji: string;
  coperti: number;
  massimi: number;
  postiLiberi: number;
};

/** Edifici con posti lavoro (edifici pubblici), ordinati per posti liberi decrescenti. */
export function elencoPostazioniLavoroOrdinato(edifici: Edificio[]): PostazioneLavoroRiga[] {
  return edifici
    .filter((e) => isEdificioPubblicoConPostazioniLavoro(e))
    .map((e) => {
      const coperti =
        e.nome === "Castello"
          ? Math.min(CAPACITA_GUARDIE_CASTELLO, Math.max(0, (e.abitantiAssegnati ?? []).length - 1))
          : (e.abitantiAssegnati ?? []).length;
      const massimi = e.nome === "Castello" ? CAPACITA_GUARDIE_CASTELLO : capienzaPostiLavoro(e);
      return {
        edificioId: e.id,
        nome: e.nome,
        emoji: e.emoji,
        coperti,
        massimi,
        postiLiberi: massimi - coperti
      };
    })
    .sort((a, b) => {
      if (b.postiLiberi !== a.postiLiberi) return b.postiLiberi - a.postiLiberi;
      if (a.coperti !== b.coperti) return a.coperti - b.coperti;
      return a.edificioId - b.edificioId;
    });
}

/**
 * Restituisce gli abitanti con "lavoro" sincronizzato alle assegnazioni agli edifici.
 * Pensionati non toccati; chi è in un edificio-lavoro prende quel lavoro, chi era in edificio-lavoro ma non più assegnato diventa Disoccupato.
 */
export function sincronizzaLavoroDaEdifici(
  abitanti: Abitante[],
  edifici: Edificio[]
): Abitante[] {
  const idToLavoroFromEdifici = new Map<number, string>();
  edifici.forEach((edificio) => {
    const job = getLavoroPerEdificio(edificio);
    if (!job) return;
    (edificio.abitantiAssegnati ?? []).forEach((id) => idToLavoroFromEdifici.set(id, job));
  });

  let changed = false;
  const next: Abitante[] = abitanti.map((a): Abitante => {
    if (a.lavoro === "Pensionato" || isGiocatore(a)) return a;
    if (OCCUPAZIONI_RIMOSSE.has(a.lavoro)) {
      changed = true;
      return { ...a, lavoro: "Disoccupato" };
    }
    // Clero: occupazione sempre Sacerdote / Capo Spirituale.
    if (haCastaCleroEsplicita(a) || getCastaAbitante(a) === "Clero") {
      const locked = assicuraLavoroClero({ ...a, casta: "Clero" });
      if (locked.lavoro !== a.lavoro || a.casta !== "Clero") {
        changed = true;
        return { ...locked, casta: "Clero" };
      }
      return a;
    }
    if (èLavoroClero(a.lavoro) && a.lavoro === "Capo Religioso") {
      changed = true;
      return { ...a, lavoro: "Capo Spirituale" };
    }
    const jobFromEdificio = idToLavoroFromEdifici.get(a.id);
    // Consigliere e Nobili restano al loro lavoro finché sono assegnati al Castello (non diventano Guardia).
    if (a.lavoro === LAVORO_CONSIGLIERE && jobFromEdificio === LAVORO_GUARDIA) return a;
    if (getCastaAbitante(a) === "Nobile" && jobFromEdificio === LAVORO_GUARDIA) return a;
    if (jobFromEdificio) {
      if (jobFromEdificio === LAVORO_GIOCATORE && !isGiocatore(a)) return a;
      if (a.lavoro === jobFromEdificio) return a;
      changed = true;
      return { ...a, lavoro: jobFromEdificio };
    }
    if (a.lavoro === LAVORO_CONSIGLIERE) {
      changed = true;
      return { ...a, lavoro: "Disoccupato" };
    }
    if (LAVORI_DA_EDIFICIO.has(a.lavoro)) {
      changed = true;
      return { ...a, lavoro: "Disoccupato" };
    }
    return a;
  });
  return changed ? next : abitanti;
}

/**
 * Ogni abitante con lavoro «Agricoltore» deve comparire in almeno una Serra operativa.
 * Assegna automaticamente ai posti liberi (ordine edificio id crescente) senza duplicare id.
 */
export function assicuraAgricoltoriNelleSerre(abitanti: Abitante[], edifici: Edificio[]): Edificio[] {
  const serre = edifici
    .filter((e) => e.nome === "Serra" && e.stato === "Operativo")
    .sort((a, b) => a.id - b.id);
  if (serre.length === 0) return edifici;

  const agrIds = abitanti.filter((a) => a.lavoro === "Agricoltore").map((a) => a.id);
  if (agrIds.length === 0) return edifici;

  const giàInSerra = (id: number) =>
    edifici.some((e) => e.nome === "Serra" && (e.abitantiAssegnati ?? []).includes(id));

  const daAssegnare = agrIds.filter((id) => !giàInSerra(id));
  if (daAssegnare.length === 0) return edifici;

  const byId = new Map(edifici.map((e) => [e.id, { ...e, abitantiAssegnati: [...(e.abitantiAssegnati ?? [])] }]));
  let modified = false;

  for (const abitanteId of daAssegnare) {
    for (const s of serre) {
      const ed = byId.get(s.id);
      if (!ed) continue;
      const cap = ed.capacità ?? 0;
      const att = ed.abitantiAssegnati.length;
      if (att >= cap) continue;
      ed.abitantiAssegnati.push(abitanteId);
      ed.occupazione = ed.abitantiAssegnati.length;
      modified = true;
      break;
    }
  }

  if (!modified) return edifici;
  return edifici.map((e) => {
    const repl = byId.get(e.id);
    return repl ?? e;
  });
}

/**
 * Il Re, il Consigliere e tutti i Nobili risiedono nel Castello;
 * fino a 4 Guardie possono restare assegnate. I Nobili non contano come Guardie.
 * Chi perde la residenza fissa torna in Capanna se non ha già un’altra Residenza.
 */
export function assicuraReNelCastello(abitanti: Abitante[], edifici: Edificio[]): Edificio[] {
  const re = abitanti.find(isGiocatore);
  if (!re) return edifici;

  const fissi = idsResidentiFissiCastello(abitanti);
  const fissiSet = new Set(fissi);

  let changed = false;
  let next = edifici.map((e) => {
    if (e.id !== 1 && e.nome !== "Castello") {
      // Nobili / Re / Consigliere non restano nelle Residenze (Capanna, ecc.).
      if (e.tipo !== "Residenza") return e;
      const att = e.abitantiAssegnati ?? [];
      const filtered = att.filter((id) => !fissiSet.has(id));
      if (filtered.length === att.length) return e;
      changed = true;
      return { ...e, abitantiAssegnati: filtered, occupazione: filtered.length };
    }

    const att = e.abitantiAssegnati ?? [];
    const guardie = att.filter((id) => !fissiSet.has(id)).slice(0, CAPACITA_GUARDIE_CASTELLO);
    const dedup = [...fissi, ...guardie];
    if (dedup.length === att.length && att.every((id, i) => id === dedup[i])) return e;
    changed = true;
    return { ...e, abitantiAssegnati: dedup, occupazione: dedup.length };
  });

  const housed = new Set<number>();
  for (const e of next) {
    for (const id of e.abitantiAssegnati ?? []) housed.add(id);
  }
  const senzatetto = new Set(
    abitanti.filter((a) => a.fazioni?.includes("Senzatetto")).map((a) => a.id)
  );
  const daCapanna = abitanti
    .filter((a) => a.razza !== "Golem" && !senzatetto.has(a.id) && !housed.has(a.id))
    .map((a) => a.id);
  if (daCapanna.length > 0) {
    next = next.map((e) => {
      if (e.id !== 20 && e.nome !== "Capanna") return e;
      const ids = [...new Set([...(e.abitantiAssegnati ?? []), ...daCapanna])];
      if (ids.length === (e.abitantiAssegnati ?? []).length) return e;
      changed = true;
      return { ...e, abitantiAssegnati: ids, occupazione: ids.length };
    });
  }

  return changed ? next : edifici;
}

/**
 * Ordine: Re nel Castello, Serre con Agricoltori, poi sync lavoro dagli edifici
 * (evita finestre in cui la sync demoterebbe un Agricoltore prima dell’assegnazione).
 */
export function normalizzaLavoroEAgricoltura(abitanti: Abitante[], edifici: Edificio[]): {
  abitanti: Abitante[];
  edifici: Edificio[];
} {
  const tribunaliNormalizzati = normalizzaGiudiciTribunale(abitanti, edifici);
  const edifici1 = assicuraReNelCastello(abitanti, tribunaliNormalizzati);
  const edifici2 = assicuraAgricoltoriNelleSerre(abitanti, edifici1);
  const abitanti2 = sincronizzaLavoroDaEdifici(abitanti, edifici2);
  return { abitanti: abitanti2, edifici: edifici2 };
}

/**
 * Assegna automaticamente i Disoccupati coercibili (Servi della gleba, Schiavi) agli edifici pubblici con posti liberi.
 */
export function autoAssegnaDisoccupati(abitanti: Abitante[], edifici: Edificio[]): Edificio[] {
  const candidati = abitanti
    .filter(
      (a) =>
        a.lavoro === "Disoccupato" &&
        a.razza !== "Golem" &&
        puoEssereAssegnatoForzatamente(a)
    )
    .sort((a, b) => b.competenza - a.competenza);
  return assegnaDisoccupatiAEdificiPubblici(candidati, edifici, abitanti);
}
