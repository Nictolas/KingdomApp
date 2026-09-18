import { normalizeCapeFields } from "./capeMantello";
import { normalizeKimonoVesteFields } from "./kimonoVeste";
import { compatibleColorsForField, firstCompatibleColorForField } from "./registry";
import type { CharacterAppearance, CharacterBodyFamily, CharacterRaceId } from "./types";

export const DWARF_BEARD_STYLE = "winter";
export const PREGNANT_BODY_TYPE = "pregnant";
export const FARMER_TOOL = "watering_can";

export const RACE_BODY_FAMILY: Record<CharacterRaceId, CharacterBodyFamily> = {
  human: "humanAdult",
  elf: "humanAdult",
  dwarf: "dwarfAdult",
  halfling: "halflingAdult",
  orc: "orcAdult",
  skeleton: "humanAdult",
  vampire: "humanAdult",
  goblin: "halflingAdult",
  lizard: "humanAdult"
};

export function bodyFamilyFor(race: CharacterRaceId, ageGroup: "adult" | "teen" | "child" = "adult"): CharacterBodyFamily {
  if (ageGroup === "child") return "humanChild";
  if (ageGroup === "teen") return "humanTeen";
  return RACE_BODY_FAMILY[race];
}

/** I nani LPC usano sempre il corpo child (statura bassa) e la Winter Beard. */
export function enforceRaceBodyTypeRules(value: Partial<CharacterAppearance>): Partial<CharacterAppearance> {
  if (value.bodyType === PREGNANT_BODY_TYPE) {
    const race = value.race ?? DEFAULT_CHARACTER_APPEARANCE.race;
    return {
      ...value,
      bodyType: PREGNANT_BODY_TYPE,
      ageGroup: "adult",
      bodyFamily: bodyFamilyFor(race, "adult"),
      beardStyle: "none"
    };
  }
  if (value.race !== "dwarf") return value;
  const withBody = {
    ...value,
    bodyType: "child",
    ageGroup: "child" as const,
    bodyFamily: "humanChild" as const,
    beardStyle: DWARF_BEARD_STYLE
  };
  const beardColors = compatibleColorsForField(
    { ...DEFAULT_CHARACTER_APPEARANCE, ...withBody } as CharacterAppearance,
    "beardColor",
    "beard",
    DWARF_BEARD_STYLE
  );
  const beardColor = withBody.beardColor && beardColors.includes(withBody.beardColor)
    ? withBody.beardColor
    : firstCompatibleColorForField(
      { ...DEFAULT_CHARACTER_APPEARANCE, ...withBody } as CharacterAppearance,
      "beardColor",
      "beard",
      DWARF_BEARD_STYLE
    );
  return { ...withBody, beardColor };
}

export const DEFAULT_CHARACTER_APPEARANCE: CharacterAppearance = {
  race: "human",
  bodyType: "male",
  bodyFamily: "humanAdult",
  ageGroup: "adult",
  skinTone: "light",
  headStyle: "human_head",
  eyeColor: "blue",
  hairStyle: "messy",
  hairColor: "dark_brown",
  beardStyle: "none",
  beardColor: "dark_brown",
  outfit: "commoner",
  upperOutfit: "commoner",
  lowerOutfit: "commoner",
  fullOutfit: "none",
  fullOutfitTrim: "none",
  outfitPrimaryColor: "brown",
  outfitSecondaryColor: "charcoal",
  footwear: "none",
  footwearColor: "base",
  headwear: "none",
  cape: "none",
  capeTrim: "none",
  capeColor: "base",
  accessory: "none"
};

/** Gli agricoltori portano sempre l'annaffiatoio LPC (Tools → Watering Can). */
export function enforceProfessionAccessoryRules(
  value: Partial<CharacterAppearance>,
  lavoro?: string
): Partial<CharacterAppearance> {
  if (lavoro === "Agricoltore") return { ...value, accessory: FARMER_TOOL };
  return value;
}

export function normalizeCharacterAppearance(value?: Partial<CharacterAppearance>): CharacterAppearance {
  const normalized = enforceRaceBodyTypeRules(value ?? {});
  const race = normalized.race ?? DEFAULT_CHARACTER_APPEARANCE.race;
  const ageGroup = normalized.ageGroup ?? DEFAULT_CHARACTER_APPEARANCE.ageGroup;
  const legacyOutfit = normalized.outfit ?? DEFAULT_CHARACTER_APPEARANCE.outfit;
  const kimonoVeste = normalizeKimonoVesteFields(normalized);
  const capeFields = normalizeCapeFields(normalized);
  return enforceRaceBodyTypeRules({
    ...DEFAULT_CHARACTER_APPEARANCE,
    ...normalized,
    race,
    ageGroup,
    outfit: legacyOutfit,
    upperOutfit: normalized.upperOutfit ?? legacyOutfit,
    lowerOutfit: normalized.lowerOutfit ?? legacyOutfit,
    fullOutfit: kimonoVeste.fullOutfit,
    fullOutfitTrim: kimonoVeste.fullOutfitTrim,
    cape: capeFields.cape,
    capeTrim: capeFields.capeTrim,
    footwear: normalized.footwear === "leather" ? "none" : normalized.footwear ?? "none",
    footwearColor: normalized.footwearColor ?? (normalized.footwear === "leather" ? "leather" : DEFAULT_CHARACTER_APPEARANCE.footwearColor),
    bodyFamily: normalized.bodyFamily ?? bodyFamilyFor(race, ageGroup)
  }) as CharacterAppearance;
}

/** Applica le regole pubbliche senza mutare i dati persistiti del personaggio. */
export function appearanceForPublicSpace(
  value: CharacterAppearance,
  rules: { isKing: boolean; nudismoAttivo: boolean; incinta?: boolean; lavoro?: string }
): CharacterAppearance {
  const fallbackOutfit = !rules.nudismoAttivo ? "commoner" : "none";
  const withPregnancy = rules.incinta
    ? {
        ...value,
        bodyType: PREGNANT_BODY_TYPE,
        ageGroup: "adult" as const,
        bodyFamily: bodyFamilyFor(value.race, "adult"),
        beardStyle: "none"
      }
    : value;
  const withProfession = enforceProfessionAccessoryRules(withPregnancy, rules.lavoro);
  return normalizeCharacterAppearance({
    ...withProfession,
    headwear: !rules.isKing && withProfession.headwear === "crown" ? "none" : withProfession.headwear,
    outfit: withProfession.outfit === "none" ? fallbackOutfit : withProfession.outfit,
    upperOutfit: withProfession.upperOutfit === "none" ? fallbackOutfit : withProfession.upperOutfit,
    lowerOutfit: withProfession.lowerOutfit === "none" ? fallbackOutfit : withProfession.lowerOutfit
  });
}
