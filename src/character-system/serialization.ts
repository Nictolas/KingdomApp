import { normalizeCharacterAppearance } from "./appearance";
import type { CharacterAppearance } from "./types";

export function serializeCharacterAppearance(appearance: CharacterAppearance): string {
  return JSON.stringify(appearance);
}

export function deserializeCharacterAppearance(serialized: string): CharacterAppearance {
  const value = JSON.parse(serialized) as Partial<CharacterAppearance>;
  if (!value || typeof value !== "object" || typeof value.race !== "string") {
    throw new Error("CharacterAppearance non valido");
  }
  return normalizeCharacterAppearance(value);
}

