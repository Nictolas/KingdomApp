export const GAME_MODES = ["avventura", "creativa"] as const;

export type GameMode = (typeof GAME_MODES)[number];

export function normalizeGameMode(value: unknown): GameMode {
  return value === "creativa" ? "creativa" : "avventura";
}
