export type GameMode = "adventure" | "creative";

export const DEFAULT_GAME_MODE: GameMode = "adventure";

export const GAME_MODE_OPTIONS: ReadonlyArray<{
  id: GameMode;
  label: string;
  description: string;
}> = [
  {
    id: "adventure",
    label: "Avventura",
    description: "L'esperienza normale di MyKingdom."
  },
  {
    id: "creative",
    label: "Creativa",
    description: "Una partita separata in modalità Creativa."
  }
];

export function isGameMode(value: unknown): value is GameMode {
  return value === "adventure" || value === "creative";
}

export function normalizeGameMode(value: unknown): GameMode {
  return isGameMode(value) ? value : DEFAULT_GAME_MODE;
}
