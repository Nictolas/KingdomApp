import type { Abitante, Edificio } from "../types";
import { edificiData } from "../data/edificiData";
import { EDIFICIO_COMPETENZA_RICHIESTA, type CompetenzaEdificio } from "../data/edificiCompetenze";
import { getCastaAbitante } from "./casta";
import { abitanteCercaLavoroPerSoldi, abitanteVuolePrendereLavoro } from "./bisogni";
import { getMoneteInventarioAbitante } from "./inventario";
import { isGiocatore, puoEssereAssegnatoForzatamente } from "./schiavituCommercio";

/** Mappa edificioId → nome lavoro. Usata per sincronizzare lavoro abitante e per auto-assign Skip Mese. */
export const EDIFICIO_TO_LAVORO: Record<number, string> = {
  2: "Agricoltore",     // Serra
  21: "Agricoltore",    // Serra (seconda unità)
  3: "Tecnico",         // Raffineria Mineraria
  5: "Ricercatore",     // Laboratorio di Ricerca
  6: "Operatore",       // Centrale Energetica
  7: "Medico",          // Ospedale
  11: "Insegnante",     // Scuola
  12: "Giudice",        // Tribunale
  13: "Operatore",      // Impianto di Riciclo
  15: "Operatore",      // Dissalatore
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
  31: "Religioso"           // Luogo di Culto degli Alieni
};

const LAVORI_DA_EDIFICIO = new Set(Object.values(EDIFICIO_TO_LAVORO));

const EDIFICI_PUBBLICI_ESCLUSI = new Set(["Campo di Lavoro", "Campo di Sterminio"]);

/** Edificio pubblico con postazioni lavoro (stipendi pagati dal tesoro del giocatore). */
export function isEdificioPubblicoConPostazioniLavoro(edificio: Edificio): boolean {
  if (edificio.stato !== "Operativo") return false;
  if (edificio.tipo === "Residenza") return false;
  if (EDIFICI_PUBBLICI_ESCLUSI.has(edificio.nome)) return false;
  const cap = edificio.capacità ?? 0;
  if (cap <= 0) return false;
  return (
    getLavoroPerEdificio(edificio) != null ||
    getCompetenzaMinimaPerEdificio(edificio) != null ||
    edificio.tipo === "Luogo di Culto"
  );
}

function assegnaDisoccupatiAEdificiPubblici(candidati: Abitante[], edifici: Edificio[]): Edificio[] {
  const assigned = new Set<number>();
  const edificiOut = edifici.map((e) => ({ ...e, abitantiAssegnati: [...(e.abitantiAssegnati ?? [])] }));

  const conReq = edificiOut
    .filter(isEdificioPubblicoConPostazioniLavoro)
    .map((edificio) => ({
      edificio,
      req: getCompetenzaMinimaPerEdificio(edificio) ?? {
        competenzaMinima: 0,
        nomeCompetenza: "Competenza Generale"
      }
    }))
    .sort((a, b) => a.edificio.id - b.edificio.id);

  for (const { edificio, req } of conReq) {
    const cap = edificio.capacità ?? 0;
    const slotLiberi = cap - edificio.abitantiAssegnati!.length;
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

/** Cittadini disoccupati cercano autonomamente posti vacanti negli edifici pubblici.
 *  Priorità a chi ha bisogni a pagamento e poche monete. */
export function autoAssegnaCittadiniDisoccupati(abitanti: Abitante[], edifici: Edificio[]): Edificio[] {
  const candidati = abitanti
    .filter((a) => {
      if (isGiocatore(a)) return false;
      if (!abitanteVuolePrendereLavoro(a)) return false;
      if (a.lavoro === "Pensionato" || a.lavoro === "Prigioniero") return false;
      if (a.razza === "Robot") return false;
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
  return assegnaDisoccupatiAEdificiPubblici(candidati, edifici);
}

/** True se il cittadino disoccupato può essere assunto in quell'edificio (posti + competenza). */
export function edificioAccettaDisoccupatoCittadino(abitante: Abitante, edificio: Edificio): boolean {
  if (isGiocatore(abitante)) return false;
  if (!abitanteVuolePrendereLavoro(abitante)) return false;
  if (abitante.razza === "Robot") return false;
  if (getCastaAbitante(abitante) !== "Cittadino") return false;
  if (!isEdificioPubblicoConPostazioniLavoro(edificio)) return false;
  const cap = edificio.capacità ?? 0;
  const assegnati = edificio.abitantiAssegnati ?? [];
  if (assegnati.length >= cap) return false;
  if (assegnati.includes(abitante.id)) return false;
  const req = getCompetenzaMinimaPerEdificio(edificio);
  const min = req?.competenzaMinima ?? 0;
  return abitante.competenza >= min;
}

/** Edifici pubblici con posto libero per cui il disoccupato cittadino è idoneo. */
export function elencoEdificiConPostoPerDisoccupato(abitante: Abitante, edifici: Edificio[]): Edificio[] {
  return edifici
    .filter((e) => edificioAccettaDisoccupatoCittadino(abitante, e))
    .sort((a, b) => a.id - b.id);
}

/**
 * Assume un cittadino disoccupato in un edificio pubblico (es. arrivo sulla mappa «cerca lavoro»).
 */
export function assumiCittadinoDisoccupatoInEdificio(
  abitanti: Abitante[],
  edifici: Edificio[],
  abitanteId: number,
  edificioId: number
): { abitanti: Abitante[]; edifici: Edificio[]; ok: boolean } {
  const ab = abitanti.find((a) => a.id === abitanteId);
  const ed = edifici.find((e) => e.id === edificioId);
  if (!ab || !ed || !edificioAccettaDisoccupatoCittadino(ab, ed)) {
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
 * Esclude solo chi è già in un edificio-lavoro (non le residenze Capanna/Baracca/Dormitorio).
 */
export function getServiDellaGlebaAssegnabili(abitanti: Abitante[], edifici: Edificio[]): Abitante[] {
  const giàAssegnatiLavoro = new Set<number>();
  edifici.forEach((e) => {
    if (getLavoroPerEdificio(e) == null) return;
    (e.abitantiAssegnati ?? []).forEach((id) => giàAssegnatiLavoro.add(id));
  });

  return abitanti.filter((a) => {
    if (getCastaAbitante(a) !== "Servo della gleba") return false;
    if (a.lavoro === "Pensionato" || a.lavoro === "Prigioniero" || a.razza === "Robot") return false;
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
  const postiLiberi = (edificio.capacità ?? 0) - (edificio.abitantiAssegnati ?? []).length;
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
      const coperti = (e.abitantiAssegnati ?? []).length;
      const massimi = e.capacità ?? 0;
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
  const next = abitanti.map((a) => {
    if (a.lavoro === "Pensionato" || isGiocatore(a)) return a;
    const jobFromEdificio = idToLavoroFromEdifici.get(a.id);
    if (jobFromEdificio) {
      if (a.lavoro === jobFromEdificio) return a;
      changed = true;
      return { ...a, lavoro: jobFromEdificio };
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
 * Ordine: prima si riempiono le Serre con gli Agricoltori, poi si sincronizza il lavoro dagli edifici
 * (evita finestre in cui la sync demoterebbe un Agricoltore prima dell’assegnazione).
 */
export function normalizzaLavoroEAgricoltura(abitanti: Abitante[], edifici: Edificio[]): {
  abitanti: Abitante[];
  edifici: Edificio[];
} {
  const edifici2 = assicuraAgricoltoriNelleSerre(abitanti, edifici);
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
        a.razza !== "Robot" &&
        puoEssereAssegnatoForzatamente(a)
    )
    .sort((a, b) => b.competenza - a.competenza);
  return assegnaDisoccupatiAEdificiPubblici(candidati, edifici);
}
