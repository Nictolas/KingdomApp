/**
 * Banditi del Bosco: SOLO eventi astratti. Non creare personaggi, sprite, accampamenti
 * o altre entità fisiche. Il cittadino derubato è invece un abitante già esistente.
 */
export type BottinoRubato = { itemId: string; quantità: number };
export type InventarioMinimo = readonly BottinoRubato[];
export type EsitoAssalto = "rapina" | "ferite" | "morte";
export type RapinaBosco = {
  id: string;
  abitanteId: number;
  giorno: number;
  esito: EsitoAssalto;
  rubato: BottinoRubato;
  dannoSalute: number;
};

function casualeDeterministico(...numeri: number[]): number {
  let hash = 2166136261 >>> 0;
  for (const n of numeri) {
    hash ^= Math.trunc(n) >>> 0;
    hash = Math.imul(hash, 16777619) >>> 0;
    hash ^= hash >>> 13;
  }
  return hash / 4294967296;
}

/** Probabilità giornaliera indicativa, già ridotta dai Guardaboschi attivi. */
export function probabilitaRapinaBosco(guardaboschiAttivi: number): number {
  return Math.max(0.002, 0.03 * Math.pow(0.72, Math.max(0, Math.floor(guardaboschiAttivi))));
}

export function possibileAssaltoBanditi(input: {
  mondoSeed: number; giorno: number; abitanteId: number;
  staLavorandoNelBosco: boolean; guardaboschiAttivi: number;
  haGiaSubitoEventoOggi: boolean;
}): boolean {
  if (!input.staLavorandoNelBosco || input.haGiaSubitoEventoOggi) return false;
  return casualeDeterministico(input.mondoSeed, input.giorno, input.abitanteId, 11) <
    probabilitaRapinaBosco(input.guardaboschiAttivi);
}

/**
 * Un assalto viene risolto sul solo inventario della vittima.
 * Nessuna merce è generata: gli oggetti sono rimossi e non trasferiti ad NPC.
 * Restituisce null se non esiste nulla da rubare.
 */
export function risolviAssaltoBanditi(input: {
  mondoSeed: number; giorno: number; abitanteId: number;
  inventario: InventarioMinimo;
}): { inventario: BottinoRubato[]; evento: RapinaBosco } | null {
  const candidati = input.inventario.filter((v) => Number.isFinite(v.quantità) && v.quantità >= 1);
  if (!candidati.length) return null;
  const index = Math.floor(casualeDeterministico(input.mondoSeed, input.giorno, input.abitanteId, 22) * candidati.length);
  const scelta = candidati[index]!;
  const quantità = Math.max(1, Math.min(Math.floor(scelta.quantità),
    1 + Math.floor(casualeDeterministico(input.mondoSeed, input.giorno, input.abitanteId, 23) * 3)));
  const gravità = casualeDeterministico(input.mondoSeed, input.giorno, input.abitanteId, 24);
  const esito: EsitoAssalto = gravità < 0.003 ? "morte" : gravità < 0.10 ? "ferite" : "rapina";
  const dannoSalute = esito === "morte" ? 100 : esito === "ferite" ? 10 : 0;
  return {
    inventario: input.inventario.map((v) => v.itemId === scelta.itemId
      ? { ...v, quantità: Math.max(0, v.quantità - quantità) } : { ...v }),
    evento: {
      id: "bosco-" + input.giorno + "-" + input.abitanteId,
      abitanteId: input.abitanteId, giorno: input.giorno, esito,
      rubato: { itemId: scelta.itemId, quantità }, dannoSalute
    }
  };
}

export type StatoUdienzaRapina = "verso_castello" | "pronta" | "chiusa";
export type RichiestaRisarcimentoBanditi = {
  id: string;
  eventoId: string;
  abitanteId: number;
  stato: StatoUdienzaRapina;
  dannoMonete: number;
  scelta?: "risarcisci" | "ignora";
};

export function creaRichiestaBanditi(
  evento: RapinaBosco, dannoMonete: number
): RichiestaRisarcimentoBanditi | null {
  if (evento.esito === "morte") return null;
  return {
    id: "udienza-" + evento.id,
    eventoId: evento.id,
    abitanteId: evento.abitanteId,
    stato: "verso_castello",
    dannoMonete: Math.max(0, Math.floor(dannoMonete))
  };
}

/** L'udienza è disponibile solo dopo ingresso effettivo al Castello. */
export function registraIngressoCastello(
  richiesta: RichiestaRisarcimentoBanditi, abitanteId: number,
  edificioNome: string, ingressoReale: boolean
): RichiestaRisarcimentoBanditi {
  if (richiesta.stato !== "verso_castello" || richiesta.abitanteId !== abitanteId ||
    edificioNome !== "Castello" || !ingressoReale) return richiesta;
  return { ...richiesta, stato: "pronta" };
}

/** Solo Risarcisci o Ignora conclude l'udienza; il parere non cambia lo stato. */
export function rispondiAReclamoBanditi(
  richiesta: RichiestaRisarcimentoBanditi,
  scelta: "risarcisci" | "ignora" | "chiedi_al_consigliere",
  moneteTesoro: number
): {
  richiesta: RichiestaRisarcimentoBanditi; moneteTesoro: number;
  monetePerCittadino: number; mostraParere: boolean; riuscito: boolean
} {
  const tesoro = Math.max(0, Math.floor(moneteTesoro));
  const base = { richiesta, moneteTesoro: tesoro, monetePerCittadino: 0, mostraParere: false };
  if (richiesta.stato !== "pronta") return { ...base, riuscito: false };
  if (scelta === "chiedi_al_consigliere") {
    return { ...base, mostraParere: true, riuscito: true };
  }
  if (scelta === "risarcisci" && tesoro < richiesta.dannoMonete) {
    return { ...base, riuscito: false };
  }
  const rimborso = scelta === "risarcisci" ? richiesta.dannoMonete : 0;
  return {
    richiesta: { ...richiesta, stato: "chiusa", scelta },
    moneteTesoro: tesoro - rimborso,
    monetePerCittadino: rimborso,
    mostraParere: false,
    riuscito: true
  };
}

export function parereConsiglierePerRapina(
  richiesta: RichiestaRisarcimentoBanditi
): { risarcisci: string; ignora: string } {
  return {
    risarcisci: "Compensare il cittadino costa " + richiesta.dannoMonete +
      " monete del Tesoro e può migliorare la sua Soddisfazione. Il furto originale non viene annullato.",
    ignora: "Ignorare la richiesta conserva le monete del Tesoro, ma può diminuire la Soddisfazione del cittadino."
  };
}
