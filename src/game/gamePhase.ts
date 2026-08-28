export type GamePhase = "commander-creation" | "activating" | "running";

/** La simulazione può mutare il mondo soltanto dopo che l'introduzione è terminata. */
export function isSimulationRunning(phase: GamePhase): boolean {
  return phase === "running";
}

/** Esegue un effetto automatico solo durante la partita attiva. */
export function runWhenSimulationIsRunning(phase: GamePhase, effect: () => void): boolean {
  if (!isSimulationRunning(phase)) return false;
  effect();
  return true;
}
