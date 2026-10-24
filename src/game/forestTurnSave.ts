import type { TurnoForestale, ProfessioneForestale, FaseTurnoForestale } from "./turniForestali";

/** Checkpoint forestale salvato insieme alla partita, non in uno storage a parte. */
export type CheckpointTurniForestali = Record<number, TurnoForestale>;

const lavori = new Set<ProfessioneForestale>([
  "Raccoglitore", "Cacciatore", "Taglialegna", "Guardaboschi",
  "Erborista", "Apicoltore", "Silvicoltore", "Druido"
]);
const fasi = new Set<FaseTurnoForestale>([
  "verso_sede", "preparazione", "verso_bosco", "nel_bosco",
  "ritorno_sede", "deposito", "ritorno_casa", "finito", "sospeso"
]);
const valido = (n: unknown) =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= 0;

function verificaTurno(value: unknown, abitanteId: number): TurnoForestale {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Turno forestale non valido nel salvataggio.");
  }
  const t = value as TurnoForestale;
  if (!valido(abitanteId) || t.abitanteId !== abitanteId ||
      !valido(t.giorno) || !lavori.has(t.lavoro) || !fasi.has(t.fase) ||
      (t.sedeId !== null && !valido(t.sedeId)) ||
      !valido(t.minutiNelBosco) || !valido(t.ultimoMinuto) ||
      (t.fineFaseAlMinuto !== null && !valido(t.fineFaseAlMinuto)) ||
      !valido(t.minutiPreparazione) || !valido(t.minutiDeposito)) {
    throw new Error("Dati del turno forestale incoerenti nel salvataggio.");
  }
  return {
    abitanteId, giorno: t.giorno, lavoro: t.lavoro, sedeId: t.sedeId,
    fase: t.fase, minutiNelBosco: t.minutiNelBosco,
    ultimoMinuto: t.ultimoMinuto, fineFaseAlMinuto: t.fineFaseAlMinuto,
    minutiPreparazione: t.minutiPreparazione, minutiDeposito: t.minutiDeposito
  };
}

/** Non trascinare riferimenti allo stato runtime nel JSON persistito. */
export function checkpointTurniForestali(
  source: Record<number, TurnoForestale> | undefined
): CheckpointTurniForestali {
  const output: CheckpointTurniForestali = {};
  if (!source) return output;
  for (const [key, value] of Object.entries(source)) {
    const id = Number(key);
    if (!Number.isSafeInteger(id) || id < 0) throw new Error("ID forestale salvato non valido.");
    output[id] = verificaTurno(value, id);
  }
  return output;
}

/**
 * Dopo un vero riavvio non è più nota la posizione fisica del lavoratore:
 * sospendiamo il turno già iniziato, senza azzerare i minuti realmente svolti
 * e SENZA simulare un arrivo al Bosco o depositare nuovo bottino.
 */
export function ripristinaTurniForestali(
  source: Record<number, TurnoForestale> | undefined
): CheckpointTurniForestali {
  const loaded = checkpointTurniForestali(source);
  for (const [id, turn] of Object.entries(loaded)) {
    if (turn.fase !== "finito" && turn.fase !== "sospeso") {
      loaded[Number(id)] = { ...turn, fase: "sospeso", fineFaseAlMinuto: null };
    }
  }
  return loaded;
}
