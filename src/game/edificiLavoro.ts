import type { Abitante, Edificio } from "../types";
import { edificiData } from "../data/edificiData";
import { EDIFICIO_COMPETENZA_RICHIESTA, type CompetenzaEdificio } from "../data/edificiCompetenze";
import { getCastaAbitante } from "./casta";
import { puoEssereAssegnatoForzatamente } from "./schiavituCommercio";

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
  18: "Polizia",        // Centrale (polizia)
  22: "Funzionario",     // Ufficio Immigrazione
  23: "Commerciante",    // Mercato
  24: "Insegnante",      // Asilo
  25: "Insegnante",      // Scuola Elementare
  26: "Insegnante",      // Scuola Superiore
  27: "Insegnante",      // Università
  28: "Commerciante",    // Negozio
  29: "Cuoco"             // Mensa Pubblica
};

const LAVORI_DA_EDIFICIO = new Set(Object.values(EDIFICIO_TO_LAVORO));

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

/** Edifici con posti lavoro (lavoro associato), ordinati per posti liberi decrescenti. */
export function elencoPostazioniLavoroOrdinato(edifici: Edificio[]): PostazioneLavoroRiga[] {
  return edifici
    .filter((e) => getLavoroPerEdificio(e) != null && e.stato === "Operativo")
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
    if (a.lavoro === "Pensionato") return a;
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
 * Assegna automaticamente i Disoccupati (non Robot) agli edifici con posti liberi,
 * se la competenza dell'abitante è >= competenzaMinima dell'edificio.
 * Ordine edifici per id; per ogni edificio si riempiono i posti con i disoccupati migliori (competenza più alta).
 * Restituisce i nuovi edifici (con abitantiAssegnati aggiornati).
 */
export function autoAssegnaDisoccupati(abitanti: Abitante[], edifici: Edificio[]): Edificio[] {
  const disoccupati = abitanti
    .filter(
      (a) =>
        a.lavoro === "Disoccupato" &&
        a.razza !== "Robot" &&
        puoEssereAssegnatoForzatamente(a)
    )
    .sort((a, b) => b.competenza - a.competenza);
  const assigned = new Set<number>();
  const edificiOut = edifici.map((e) => ({ ...e, abitantiAssegnati: [...(e.abitantiAssegnati ?? [])] }));

  const conReq = edificiOut
    .map((edificio) => ({ edificio, req: getCompetenzaMinimaPerEdificio(edificio) }))
    .filter((x): x is { edificio: Edificio; req: CompetenzaEdificio } => x.req != null)
    .sort((a, b) => a.edificio.id - b.edificio.id);

  for (const { edificio, req } of conReq) {
    const cap = edificio.capacità ?? 0;
    const current = edificio.abitantiAssegnati!.length;
    const slotLiberi = cap - current;
    if (slotLiberi <= 0) continue;

    let aggiunti = 0;
    for (const a of disoccupati) {
      if (aggiunti >= slotLiberi) break;
      if (assigned.has(a.id)) continue;
      if (a.competenza < req.competenzaMinima) continue;
      edificio.abitantiAssegnati!.push(a.id);
      assigned.add(a.id);
      aggiunti++;
    }
  }

  return edificiOut;
}
