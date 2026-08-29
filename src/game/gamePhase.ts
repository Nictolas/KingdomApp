export type GamePhase = "loading" | "commander-creation" | "activating" | "restoring" | "running";

export function isSimulationRunning(phase: GamePhase): boolean {
  return phase === "running";
}
