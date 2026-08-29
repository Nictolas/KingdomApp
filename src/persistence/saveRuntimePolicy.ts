import type { GamePhase } from "../game/gamePhase";
import type { LoadSaveResult } from "./saveRepository.ts";

export type StartupDecision = "start-new" | "show-choice";

export function decideStartup(result: LoadSaveResult): StartupDecision {
  return result.source === "none" ? "start-new" : "show-choice";
}

export function shouldConfirmNewGame(result: LoadSaveResult | null): boolean {
  return result != null && result.source !== "none";
}

export function shouldAutosave(input: { dirty: boolean; phase: GamePhase; startupActive: boolean }): boolean {
  return input.dirty && input.phase === "running" && input.startupActive;
}

export async function runMutationThenSave(mutate: () => Promise<void>, save: () => Promise<void>): Promise<void> {
  await mutate();
  await save();
}
