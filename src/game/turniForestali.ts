/**
 * Motore puro della routine forestale.
 * Gli spostamenti vengono eseguiti sulla mappa: una fase cambia solo dopo
 * la notifica dell'arrivo reale alla porta o dopo il tempo trascorso nella sede.
 * Non contiene NPC banditi né coordinate predefinite degli edifici.
 */
export type ProfessioneForestale =
  | "Raccoglitore" | "Cacciatore" | "Taglialegna" | "Guardaboschi"
  | "Erborista" | "Apicoltore" | "Silvicoltore" | "Druido";

export const SEDE_PER_PROFESSIONE: Readonly<Record<ProfessioneForestale, string | null>> = {
  Raccoglitore: null,
  Cacciatore: "Capanna del Cacciatore",
  Taglialegna: "Campo dei Taglialegna",
  Guardaboschi: "Capanno del Guardaboschi",
  Erborista: "Erboristeria",
  Apicoltore: "Apiario",
  Silvicoltore: "Vivaio forestale",
  Druido: "Cerchio dei Druidi"
};

/** Le sedi sono costruibili su qualsiasi terreno normalmente edificabile. */
export const SEDI_FORESTALI = Object.values(SEDE_PER_PROFESSIONE).filter(
  (nome): nome is string => nome !== null
);

export type FaseTurnoForestale =
  | "verso_sede" | "preparazione" | "verso_bosco" | "nel_bosco"
  | "ritorno_sede" | "deposito" | "ritorno_casa" | "finito" | "sospeso";

export type DestinazioneForestale = "sede" | "bosco" | "casa";
export type TurnoForestale = {
  abitanteId: number;
  giorno: number;
  lavoro: ProfessioneForestale;
  /** ID dell'edificio effettivamente costruito, non un punto fisso della mappa. */
  sedeId: number | null;
  fase: FaseTurnoForestale;
  minutiNelBosco: number;
  ultimoMinuto: number;
  fineFaseAlMinuto: number | null;
  minutiPreparazione: number;
  minutiDeposito: number;
};

export function iniziaTurnoForestale(input: {
  abitanteId: number; giorno: number; lavoro: ProfessioneForestale;
  sedeId: number | null; minuto: number;
  minutiPreparazione?: number; minutiDeposito?: number;
}): TurnoForestale {
  const obbligatoria = SEDE_PER_PROFESSIONE[input.lavoro] !== null;
  if (obbligatoria && input.sedeId === null) {
    throw new Error("Una professione forestale specializzata richiede una sede assegnata");
  }
  return {
    abitanteId: input.abitanteId,
    giorno: input.giorno,
    lavoro: input.lavoro,
    sedeId: input.sedeId,
    fase: obbligatoria ? "verso_sede" : "verso_bosco",
    minutiNelBosco: 0,
    ultimoMinuto: input.minuto,
    fineFaseAlMinuto: null,
    minutiPreparazione: Math.max(0, input.minutiPreparazione ?? 60),
    minutiDeposito: Math.max(0, input.minutiDeposito ?? 20)
  };
}

export function destinazioneTurnoForestale(
  turno: TurnoForestale
): DestinazioneForestale | null {
  switch (turno.fase) {
    case "verso_sede":
    case "ritorno_sede": return "sede";
    case "verso_bosco": return "bosco";
    case "ritorno_casa": return "casa";
    default: return null;
  }
}

/**
 * Chiamare SOLO dopo che il personaggio ha realmente raggiunto la destinazione;
 * la funzione non muove il personaggio e non simula teletrasporti.
 */
export function segnalaArrivoTurnoForestale(
  turno: TurnoForestale,
  destinazione: DestinazioneForestale,
  minuto: number
): TurnoForestale {
  if (destinazioneTurnoForestale(turno) !== destinazione) return turno;
  if (minuto < turno.ultimoMinuto) return turno;
  if (turno.fase === "verso_sede") {
    return {
      ...turno, fase: "preparazione", ultimoMinuto: minuto,
      fineFaseAlMinuto: minuto + turno.minutiPreparazione
    };
  }
  if (turno.fase === "verso_bosco") {
    return { ...turno, fase: "nel_bosco", ultimoMinuto: minuto };
  }
  if (turno.fase === "ritorno_sede") {
    return {
      ...turno, fase: "deposito", ultimoMinuto: minuto,
      fineFaseAlMinuto: minuto + turno.minutiDeposito
    };
  }
  return { ...turno, fase: "finito", ultimoMinuto: minuto };
}

/** Conta il tempo produttivo solo quando l'abitante è già nel Bosco. */
export function aggiornaTurnoForestale(
  turno: TurnoForestale,
  minuto: number,
  fineOrarioLavoro: number
): TurnoForestale {
  if (minuto <= turno.ultimoMinuto || turno.fase === "finito" || turno.fase === "sospeso") {
    return turno;
  }
  const fine = Math.max(0, fineOrarioLavoro);
  const minEfficace = Math.min(minuto, fine);
  if (turno.fase === "nel_bosco") {
    const increment = Math.max(0, minEfficace - turno.ultimoMinuto);
    return {
      ...turno, minutiNelBosco: turno.minutiNelBosco + increment,
      ultimoMinuto: minuto,
      fase: minuto >= fine ? (turno.sedeId === null ? "ritorno_casa" : "ritorno_sede") : "nel_bosco"
    };
  }
  if (turno.fase === "preparazione" && minuto >= fine) {
    return { ...turno, ultimoMinuto: minuto, fineFaseAlMinuto: null, fase: "ritorno_casa" };
  }
  if (turno.fase === "preparazione" && minuto >= (turno.fineFaseAlMinuto ?? Infinity)) {
    return { ...turno, ultimoMinuto: minuto, fineFaseAlMinuto: null, fase: "verso_bosco" };
  }
  if (turno.fase === "deposito" && minuto >= (turno.fineFaseAlMinuto ?? Infinity)) {
    return { ...turno, ultimoMinuto: minuto, fineFaseAlMinuto: null, fase: "ritorno_casa" };
  }
  if (turno.fase === "verso_sede" && minuto >= fine) {
    return { ...turno, ultimoMinuto: minuto, fase: "ritorno_casa" };
  }
  if (turno.fase === "verso_bosco" && minuto >= fine) {
    return { ...turno, ultimoMinuto: minuto, fase: turno.sedeId === null ? "ritorno_casa" : "ritorno_sede" };
  }
  return { ...turno, ultimoMinuto: minuto };
}

/** Una rapina o un problema di salute interrompe il lavoro senza cancellare i progressi. */
export function sospendiTurnoForestale(turno: TurnoForestale): TurnoForestale {
  return { ...turno, fase: "sospeso", fineFaseAlMinuto: null };
}
