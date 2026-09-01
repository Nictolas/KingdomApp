import type { CharacterAppearance, CharacterBodyFamily, CharacterRaceId } from "./types";

export const RACE_BODY_FAMILY: Record<CharacterRaceId, CharacterBodyFamily> = {
  human: "humanAdult",
  elf: "humanAdult",
  dwarf: "dwarfAdult",
  halfling: "halflingAdult",
  orc: "orcAdult"
};

export function bodyFamilyFor(race: CharacterRaceId, ageGroup: "adult" | "teen" | "child" = "adult"): CharacterBodyFamily {
  if (ageGroup === "child") return "humanChild";
  if (ageGroup === "teen") return "humanTeen";
  return RACE_BODY_FAMILY[race];
}

export const DEFAULT_CHARACTER_APPEARANCE: CharacterAppearance = {
  race: "human",
  bodyType: "male",
  bodyFamily: "humanAdult",
  ageGroup: "adult",
  skinTone: "light",
  eyeColor: "blue",
  hairStyle: "messy",
  hairColor: "dark_brown",
  beardStyle: "none",
  beardColor: "dark_brown",
  outfit: "commoner",
  upperOutfit: "commoner",
  lowerOutfit: "commoner",
  outfitPrimaryColor: "brown",
  outfitSecondaryColor: "charcoal",
  footwear: "leather",
  headwear: "none",
  accessory: "none"
};

export function normalizeCharacterAppearance(value?: Partial<CharacterAppearance>): CharacterAppearance {
  const race = value?.race ?? DEFAULT_CHARACTER_APPEARANCE.race;
  const ageGroup = value?.ageGroup ?? DEFAULT_CHARACTER_APPEARANCE.ageGroup;
  const legacyOutfit = value?.outfit ?? DEFAULT_CHARACTER_APPEARANCE.outfit;
  return {
    ...DEFAULT_CHARACTER_APPEARANCE,
    ...value,
    race,
    ageGroup,
    outfit: legacyOutfit,
    upperOutfit: value?.upperOutfit ?? legacyOutfit,
    lowerOutfit: value?.lowerOutfit ?? legacyOutfit,
    bodyFamily: value?.bodyFamily ?? bodyFamilyFor(race, ageGroup)
  };
}

/** Applica le regole pubbliche senza mutare i dati persistiti del personaggio. */
export function appearanceForPublicSpace(
  value: CharacterAppearance,
  rules: { isKing: boolean; nudismoAttivo: boolean }
): CharacterAppearance {
  const fallbackOutfit = !rules.nudismoAttivo ? "commoner" : "none";
  return normalizeCharacterAppearance({
    ...value,
    headwear: !rules.isKing && value.headwear === "crown" ? "none" : value.headwear,
    outfit: value.outfit === "none" ? fallbackOutfit : value.outfit,
    upperOutfit: value.upperOutfit === "none" ? fallbackOutfit : value.upperOutfit,
    lowerOutfit: value.lowerOutfit === "none" ? fallbackOutfit : value.lowerOutfit
  });
}
