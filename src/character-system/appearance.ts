import { normalizeCapeFields } from "./capeMantello";
import { normalizeKimonoVesteFields } from "./kimonoVeste";
import {
  canRenderCharacter,
  compatibleCatalogOptions,
  compatibleColorsForField,
  firstCompatibleColorForField,
  firstCompatibleHairColor
} from "./registry";
import type { CharacterAppearance, CharacterBodyFamily, CharacterRaceId } from "./types";

export const DWARF_BEARD_STYLE = "winter";
export const ELF_EARS_STYLE = "side_wolf_skintone";
export const DWARF_CHILD_SHIRT = "child_shirt";
export const DWARF_CHILD_PANTS = "child_pants";
export const DWARF_CHILD_SKIRT = "child_skirt";
export const DWARF_SHIRT_COLORS = [
  "black", "blue", "brown", "gray", "green", "lavender", "lightblue", "pink", "red", "white"
] as const;
export const DWARF_PANTS_COLORS = [
  "black", "blue", "brown", "darkblue", "green", "lightblue", "maroon", "red", "white"
] as const;
export const DWARF_SKIRT_COLORS = [
  "black", "blue", "darkblue", "green", "lavender", "lightblue", "maroon", "pink", "red", "white"
] as const;
export const PREGNANT_BODY_TYPE = "pregnant";
export const FARMER_TOOL = "watering_can";
export const LUMBERJACK_TOOL = "axe";
export const BLACKSMITH_TOOL = "hammer";
export const MINER_TOOL = "pickaxe";
/**
 * Nell'LPC manifest la corazza "guard_chainmail" ha semanticId "guard".
 * È riservata esclusivamente agli abitanti con lavoro Guardia.
 */
export const GUARD_CHAINMAIL_OUTFIT = "guard";
export function isGuardChainmailOutfit(outfit?: string | null): boolean {
  return outfit === GUARD_CHAINMAIL_OUTFIT || outfit === "chainmail";
}

/** Ripristina gli abiti civili nei salvataggi precedenti o negli editor non militari. */
export function stripGuardChainmailFromCivilian(appearance: CharacterAppearance): CharacterAppearance {
  const upperOutfit = isGuardChainmailOutfit(appearance.upperOutfit) ? "none" : appearance.upperOutfit;
  const sleeveOutfit = isGuardChainmailOutfit(appearance.sleeveOutfit) ? "none" : appearance.sleeveOutfit;
  const lowerOutfit = isGuardChainmailOutfit(appearance.lowerOutfit) ? "none" : appearance.lowerOutfit;
  const fullOutfit = isGuardChainmailOutfit(appearance.fullOutfit) ? "none" : appearance.fullOutfit;
  const outfit = isGuardChainmailOutfit(appearance.outfit) ? upperOutfit : appearance.outfit;
  if (outfit === appearance.outfit && upperOutfit === appearance.upperOutfit &&
      sleeveOutfit === appearance.sleeveOutfit && lowerOutfit === appearance.lowerOutfit &&
      fullOutfit === appearance.fullOutfit) return appearance;
  return normalizeCharacterAppearance({
    ...appearance,
    outfit,
    upperOutfit,
    sleeveOutfit,
    lowerOutfit,
    fullOutfit,
    fullOutfitTrim: fullOutfit === "none" ? "none" : appearance.fullOutfitTrim
  });
}

export const MEDICO_CRAVAT = "cravat";
export const MEDICO_MASK = "plain_mask";
export const MEDICO_SUNGLASSES = "sunglasses";
// I copricapi in maglia metallica sono riservati all'equipaggiamento militare.
export const GIUDICE_HAIR_STYLE = "wavy";
export const GIUDICE_HAIR_COLOR = "white";
export const GIUDICE_KIMONO = "kimono";
export const MAGO_HAT = "magic_celestial";
export const GUARDIA_HELMET = "helmet_barbuta";
export const GUARDIA_HELMET_COLOR = "iron";

function pickColorFromSeed(colors: readonly string[], seed: number): string {
  if (colors.length === 0) return "purple";
  return colors[((seed >>> 0) || 1) % colors.length]!;
}

/** Outfit LPC obbligatorio per i Nani: Child shirt + pants (M) / skirt (F). */
export function dwarfChildOutfit(
  sesso: "M" | "F" | null | undefined,
  seed = 1
): Pick<CharacterAppearance, "outfit" | "upperOutfit" | "lowerOutfit" | "outfitPrimaryColor" | "outfitSecondaryColor" | "fullOutfit" | "fullOutfitTrim" | "footwear"> {
  const female = sesso === "F";
  return {
    outfit: DWARF_CHILD_SHIRT,
    upperOutfit: DWARF_CHILD_SHIRT,
    lowerOutfit: female ? DWARF_CHILD_SKIRT : DWARF_CHILD_PANTS,
    outfitPrimaryColor: pickColorFromSeed(DWARF_SHIRT_COLORS, seed),
    outfitSecondaryColor: pickColorFromSeed(female ? DWARF_SKIRT_COLORS : DWARF_PANTS_COLORS, seed + 17),
    fullOutfit: "none",
    fullOutfitTrim: "none",
    footwear: "none"
  };
}

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

/** I nani LPC usano sempre il corpo child (statura bassa) e la Winter Beard (Santa), abbassata sul mento.
 *  Gli elfi hanno sempre Side Wolf Ears Skintone (orecchie a punta). */
export function enforceRaceBodyTypeRules(value: Partial<CharacterAppearance>): Partial<CharacterAppearance> {
  if (value.bodyType === PREGNANT_BODY_TYPE) {
    const race = value.race ?? DEFAULT_CHARACTER_APPEARANCE.race;
    return {
      ...value,
      bodyType: PREGNANT_BODY_TYPE,
      ageGroup: "adult",
      bodyFamily: bodyFamilyFor(race, "adult"),
      beardStyle: "none",
      earsStyle: race === "elf" ? ELF_EARS_STYLE : "none"
    };
  }
  if (value.race === "dwarf") {
    const withBody: Partial<CharacterAppearance> = {
      ...value,
      bodyType: "child",
      ageGroup: "child",
      bodyFamily: "humanChild",
      beardStyle: DWARF_BEARD_STYLE,
      earsStyle: "none"
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
  if (value.race === "elf") {
    return { ...value, earsStyle: ELF_EARS_STYLE };
  }
  if (value.earsStyle === ELF_EARS_STYLE) {
    return { ...value, earsStyle: "none" };
  }
  return value;
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
  earsStyle: "none",
  outfit: "commoner",
  upperOutfit: "commoner",
  sleeveOutfit: "none",
  sleeveColor: "base",
  lowerOutfit: "commoner",
  fullOutfit: "none",
  fullOutfitTrim: "none",
  outfitPrimaryColor: "brown",
  outfitSecondaryColor: "charcoal",
  footwear: "none",
  footwearColor: "base",
  headwear: "none",
  headwearColor: "iron",
  neckwear: "none",
  neckwearColor: "white",
  facialMask: "none",
  facialMaskColor: "white",
  facialEyes: "none",
  facialEyesColor: "black",
  cape: "none",
  capeTrim: "none",
  capeColor: "base",
  accessory: "none"
};

/** Corporatura teen (kimono/elmetto): mai sui Nani, che restano sul corpo child. */
function professionTeenBodyPatch(value: Partial<CharacterAppearance>): Partial<CharacterAppearance> {
  const race = value.race ?? DEFAULT_CHARACTER_APPEARANCE.race;
  if (race === "dwarf") {
    return {
      bodyType: "child",
      ageGroup: "child",
      bodyFamily: "humanChild"
    };
  }
  return {
    bodyType: "teen",
    ageGroup: "teen",
    bodyFamily: bodyFamilyFor(race, "teen")
  };
}

/**
 * Cambia il vestiario soltanto nell'aspetto visualizzato: non muta mai
 * il vestito civile registrato nel salvataggio.
 * Usa semanticId già effettivamente presenti nel manifest LPC.
 */
function professionUniform(
  value: Partial<CharacterAppearance>,
  upperOutfit: "farmer" | "traveler" | "commoner",
  colors: { shirt: string; pants: string },
  accessory: string
): Partial<CharacterAppearance> {
  return {
    ...value,
    accessory,
    fullOutfit: "none",
    fullOutfitTrim: "none",
    outfit: upperOutfit,
    upperOutfit,
    lowerOutfit: upperOutfit,
    sleeveOutfit: "none",
    outfitPrimaryColor: colors.shirt,
    outfitSecondaryColor: colors.pants
  };
}

/** Strumenti e abiti LPC obbligatori per occupazione (visibile in mappa/UI, non persistito). */
export function enforceProfessionAccessoryRules(
  value: Partial<CharacterAppearance>,
  lavoro?: string,
  seed = 1
): Partial<CharacterAppearance> {
  if (lavoro === "Agricoltore") return professionUniform(value, "farmer", { shirt: "tan", pants: "brown" }, FARMER_TOOL);
  if (lavoro === "Taglialegna") return professionUniform(value, "traveler", { shirt: "forest", pants: "brown" }, LUMBERJACK_TOOL);
  if (lavoro === "Fabbro") return professionUniform(value, "farmer", { shirt: "tan", pants: "brown" }, BLACKSMITH_TOOL);
  if (lavoro === "Minatore") return professionUniform(value, "commoner", { shirt: "brown", pants: "charcoal" }, MINER_TOOL);
  if (lavoro === "Medico") {
    return {
      ...value,
      accessory: "none",
      headwear: "none",
      headwearColor: "base",
      beardStyle: "none",
      hairStyle: "none",
      hairColor: "none",
      ...professionTeenBodyPatch(value),
      fullOutfit: "kimono",
      fullOutfitTrim: "none",
      outfit: "none",
      upperOutfit: "none",
      lowerOutfit: "none",
      // La veste bianca è disponibile come kimono teen nel catalogo attuale.
      outfitPrimaryColor: "white",
      outfitSecondaryColor: "charcoal",
      neckwear: MEDICO_CRAVAT,
      neckwearColor: "white",
      facialMask: MEDICO_MASK,
      facialMaskColor: "white",
      facialEyes: MEDICO_SUNGLASSES,
      facialEyesColor: "black"
    };
  }
  if (lavoro === "Giudice") {
    return {
      ...value,
      accessory: "none",
      ...professionTeenBodyPatch(value),
      hairStyle: GIUDICE_HAIR_STYLE,
      hairColor: GIUDICE_HAIR_COLOR,
      beardStyle: "none",
      beardColor: GIUDICE_HAIR_COLOR,
      fullOutfit: GIUDICE_KIMONO,
      fullOutfitTrim: "none",
      outfit: "none",
      upperOutfit: "none",
      lowerOutfit: "none",
      outfitPrimaryColor: "black",
      outfitSecondaryColor: "charcoal",
      footwear: "none",
      headwear: "none"
    };
  }
  if (lavoro === "Mago") {
    const teenBase: Partial<CharacterAppearance> = {
      ...value,
      accessory: "none",
      ...professionTeenBodyPatch(value),
      beardStyle: "none",
      fullOutfit: "kimono",
      fullOutfitTrim: "none",
      outfit: "none",
      upperOutfit: "none",
      lowerOutfit: "none",
      sleeveOutfit: "none",
      outfitPrimaryColor: "purple",
      cape: "solid",
      capeTrim: "none",
      capeColor: "base"
    };
    const normalizedTeen = normalizeCharacterAppearance(teenBase);
    const colori = compatibleColorsForField(normalizedTeen, "headwearColor", "headwear", MAGO_HAT);
    return {
      ...teenBase,
      // Quando il cappello LPC non è nel pacchetto, conserva la veste
      // viola senza chiedere al renderer di caricare uno sprite inesistente.
      headwear: colori.length > 0 ? MAGO_HAT : "none",
      headwearColor: colori.length > 0 ? pickColorFromSeed(colori, seed) : "base"
    };
  }
  if (lavoro === "Guardia") {
    return {
      ...value,
      accessory: "none",
      ...professionTeenBodyPatch(value),
      hairStyle: "none",
      hairColor: "none",
      beardStyle: "none",
      beardColor: "none",
      headwear: GUARDIA_HELMET,
      headwearColor: GUARDIA_HELMET_COLOR,
      // L'armatura si sovrappone agli abiti civili mentre si è in servizio.
      // Il dato aspetto originale non viene modificato o salvato.
      outfit: GUARD_CHAINMAIL_OUTFIT,
      upperOutfit: GUARD_CHAINMAIL_OUTFIT,
      lowerOutfit: GUARD_CHAINMAIL_OUTFIT,
      outfitSecondaryColor: "black",
      sleeveOutfit: "none",
      fullOutfit: "none",
      fullOutfitTrim: "none",
      outfitPrimaryColor: "base"
    };
  }
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
    sleeveOutfit: normalized.sleeveOutfit ?? "none",
    sleeveColor: normalized.sleeveColor ?? "base",
    lowerOutfit: normalized.lowerOutfit ?? legacyOutfit,
    fullOutfit: kimonoVeste.fullOutfit,
    fullOutfitTrim: kimonoVeste.fullOutfitTrim,
    cape: capeFields.cape,
    capeTrim: capeFields.capeTrim,
    footwear: normalized.footwear === "leather" ? "none" : normalized.footwear ?? "none",
    footwearColor: normalized.footwearColor ?? (normalized.footwear === "leather" ? "leather" : DEFAULT_CHARACTER_APPEARANCE.footwearColor),
    headwearColor: normalized.headwearColor ?? DEFAULT_CHARACTER_APPEARANCE.headwearColor,
    neckwear: normalized.neckwear ?? DEFAULT_CHARACTER_APPEARANCE.neckwear,
    neckwearColor: normalized.neckwearColor ?? DEFAULT_CHARACTER_APPEARANCE.neckwearColor,
    facialMask: normalized.facialMask ?? DEFAULT_CHARACTER_APPEARANCE.facialMask,
    facialMaskColor: normalized.facialMaskColor ?? DEFAULT_CHARACTER_APPEARANCE.facialMaskColor,
    facialEyes: normalized.facialEyes ?? DEFAULT_CHARACTER_APPEARANCE.facialEyes,
    facialEyesColor: normalized.facialEyesColor ?? DEFAULT_CHARACTER_APPEARANCE.facialEyesColor,
    earsStyle: normalized.earsStyle ?? DEFAULT_CHARACTER_APPEARANCE.earsStyle,
    bodyFamily: normalized.bodyFamily ?? bodyFamilyFor(race, ageGroup)
  }) as CharacterAppearance;
}

function pickCompatibleOutfit(current: string, available: string[], fallback: string): string {
  return current !== "none" && available.includes(current) ? current : fallback;
}

/**
 * Adatta capelli/abiti/accessori al catalogo LPC della corporatura corrente.
 * Essenziale per i Nani (corpo child): outfit/capelli da adulto non esistono e
 * senza questo fallback si finisce nello sprite CSS legacy.
 */
export function compatibilizzaPerCatalogo(value: CharacterAppearance): CharacterAppearance {
  let appearance = normalizeCharacterAppearance(value);
  if (canRenderCharacter(appearance, "idle")) return appearance;

  const options = compatibleCatalogOptions(appearance);
  const fallbackOutfit = options.upperOutfits.includes("commoner")
    ? "commoner"
    : options.upperOutfits[0] ?? "none";
  const upperOutfit = pickCompatibleOutfit(appearance.upperOutfit, options.upperOutfits, fallbackOutfit);
  const lowerOutfit = pickCompatibleOutfit(appearance.lowerOutfit, options.lowerOutfits, fallbackOutfit);
  const fullOutfit = appearance.fullOutfit !== "none" && options.fullOutfits.includes(appearance.fullOutfit)
    ? appearance.fullOutfit
    : "none";
  const hairStyle = appearance.hairStyle !== "none" && options.hairStyles.includes(appearance.hairStyle)
    ? appearance.hairStyle
    : options.hairStyles.includes("relm_short")
      ? "relm_short"
      : options.hairStyles[0] ?? "none";

  appearance = normalizeCharacterAppearance({
    ...appearance,
    headwear: appearance.headwear !== "none" && !options.headwear.includes(appearance.headwear)
      ? "none"
      : appearance.headwear,
    fullOutfit,
    fullOutfitTrim: fullOutfit === "none" ? "none" : appearance.fullOutfitTrim,
    upperOutfit,
    sleeveOutfit: appearance.sleeveOutfit === "none" || options.upperOutfits.includes(appearance.sleeveOutfit)
      ? appearance.sleeveOutfit : "none",
    lowerOutfit,
    outfit: upperOutfit,
    hairStyle,
    footwear: appearance.footwear !== "none" && !options.footwear.includes(appearance.footwear)
      ? "none"
      : appearance.footwear,
    accessory: "none",
    neckwear: "none",
    facialMask: "none",
    facialEyes: "none"
  });

  if (appearance.hairStyle !== "none") {
    appearance = normalizeCharacterAppearance({
      ...appearance,
      hairColor: firstCompatibleHairColor(appearance, appearance.hairStyle)
    });
  }

  if (canRenderCharacter(appearance, "idle")) return appearance;

  // Ultimo fallback: come l'esempio Razze (corpo + testa + Winter Beard + child clothes se disponibili).
  const dwarfClothes =
    appearance.race === "dwarf"
      ? dwarfChildOutfit(
          appearance.lowerOutfit === DWARF_CHILD_SKIRT ? "F" : "M",
          (appearance.outfitPrimaryColor?.length ?? 1) + (appearance.beardColor?.length ?? 1)
        )
      : null;
  return normalizeCharacterAppearance({
    ...appearance,
    hairStyle: appearance.race === "dwarf" ? "none" : hairStyle,
    hairColor: appearance.race === "dwarf" ? "none" : appearance.hairColor,
    headwear: "none",
    ...(dwarfClothes ?? {
      fullOutfit: "none",
      fullOutfitTrim: "none",
      upperOutfit: "none",
      lowerOutfit: "none",
      outfit: "none",
      footwear: "none"
    }),
    neckwear: "none",
    facialMask: "none",
    facialEyes: "none",
    accessory: "none",
    cape: "none",
    capeTrim: "none"
  });
}

/** Adatta capelli, abiti e accessori al catalogo LPC della corporatura pregnant. */
export function compatibilizzaPerGravidanza(value: CharacterAppearance): CharacterAppearance {
  return compatibilizzaPerCatalogo(
    normalizeCharacterAppearance({ ...value, bodyType: PREGNANT_BODY_TYPE })
  );
}

/**
 * Allinea l'aspetto LPC alla razza di gioco (es. Nano → dwarf + corpo child),
 * senza mutare i dati persistiti finché non si passa da normalize/save.
 */
export function appearanceAlignedToRazza(
  value: CharacterAppearance,
  razza?: string | null
): CharacterAppearance {
  if (razza === "Nano") {
    return normalizeCharacterAppearance({ ...value, race: "dwarf" });
  }
  if (razza === "Elfo") {
    return normalizeCharacterAppearance({ ...value, race: "elf" });
  }
  return value;
}

/** Il torso delle abitanti femminili deve avere sempre un capo visibile.
 * La veste integrale copre già il busto. Si sceglie soltanto dal catalogo
 * compatibile col corpo attuale, anche in presenza del nudismo pubblico.
 * Non modifica i dati salvati dell'abbigliamento.
 */
export function copriBustoFemminile(
  appearance: CharacterAppearance,
  sesso?: "M" | "F" | null
): CharacterAppearance {
  if (sesso !== "F" || appearance.fullOutfit !== "none" || isGuardChainmailOutfit(appearance.upperOutfit)) return appearance;
  const options = compatibleCatalogOptions(appearance);
  const candidati = [
    appearance.upperOutfit,
    "commoner",
    "traveler",
    ...options.upperOutfits
  ].filter((v, i, all) => v !== "none" && options.upperOutfits.includes(v) && all.indexOf(v) === i);
  for (const outfit of candidati) {
    const vestita = normalizeCharacterAppearance({ ...appearance, upperOutfit: outfit, outfit });
    if (canRenderCharacter(vestita, "idle")) return vestita;
  }
  // Preferisce comunque la prima maglia esistente al busto completamente nudo.
  if (candidati.length > 0) {
    return normalizeCharacterAppearance({ ...appearance, upperOutfit: candidati[0]!, outfit: candidati[0]! });
  }
  return appearance;
}

/** Applica le regole pubbliche senza mutare i dati persistiti del personaggio. */
export function appearanceForPublicSpace(
  value: CharacterAppearance,
  rules: {
    isKing: boolean;
    nudismoAttivo: boolean;
    incinta?: boolean;
    lavoro?: string;
    seed?: number;
    /** Razza di gioco (es. "Nano"): forza race LPC coerente prima delle altre regole. */
    razza?: string | null;
    /** Serve per pants vs skirt sui Nani. */
    sesso?: "M" | "F" | null;
  }
): CharacterAppearance {
  const isGuard = rules.lavoro === "Guardia";
  // I civili (inclusi ex Guardie e Medici) non possono conservare la cotta di maglia,
  // neppure se era stata selezionata in un vecchio salvataggio.
  const aligned = appearanceAlignedToRazza(
    isGuard ? value : stripGuardChainmailFromCivilian(value),
    rules.razza
  );
  const seed = rules.seed ?? 1;
  const isDwarf = aligned.race === "dwarf" || rules.razza === "Nano";
  const dwarfSesso =
    rules.sesso ??
    (aligned.lowerOutfit === DWARF_CHILD_SKIRT ? "F" : "M");
  const dwarfClothes = isDwarf ? dwarfChildOutfit(dwarfSesso, seed) : null;
  const childLike = aligned.bodyType === "child" || isDwarf;
  const catalog = compatibleCatalogOptions(aligned);
  const fallbackOutfit = !rules.nudismoAttivo
    ? (catalog.upperOutfits.includes("commoner") ? "commoner" : catalog.upperOutfits[0] ?? "none")
    : "none";
  const effectiveFallback = dwarfClothes
    ? dwarfClothes.upperOutfit
    : childLike && fallbackOutfit === "commoner" && !catalog.upperOutfits.includes("commoner")
      ? "none"
      : fallbackOutfit;
  const withPregnancy = rules.incinta
    ? {
        ...aligned,
        bodyType: PREGNANT_BODY_TYPE,
        ageGroup: "adult" as const,
        bodyFamily: bodyFamilyFor(aligned.race, "adult"),
        beardStyle: "none"
      }
    : aligned;
  const withDwarfClothes = dwarfClothes && !rules.incinta
    ? { ...withPregnancy, ...dwarfClothes }
    : withPregnancy;
  const withProfession = enforceProfessionAccessoryRules(withDwarfClothes, rules.lavoro, seed);
  const usaKimonoProfessionale = rules.lavoro === "Medico" || rules.lavoro === "Giudice";
  const normalized = normalizeCharacterAppearance({
    ...withProfession,
    headwear: !rules.isKing && withProfession.headwear === "crown" ? "none" : withProfession.headwear,
    ...(dwarfClothes && !usaKimonoProfessionale && !isGuard
      ? dwarfClothes
      : {
          outfit: withProfession.outfit === "none" && !usaKimonoProfessionale ? effectiveFallback : withProfession.outfit,
          upperOutfit: withProfession.upperOutfit === "none" && !usaKimonoProfessionale ? effectiveFallback : withProfession.upperOutfit,
          lowerOutfit: withProfession.lowerOutfit === "none" && !usaKimonoProfessionale
            ? (dwarfClothes?.lowerOutfit ?? effectiveFallback)
            : withProfession.lowerOutfit
        })
  });
  const compatible = rules.incinta
    ? compatibilizzaPerGravidanza(normalized)
    : compatibilizzaPerCatalogo(normalized);
  if (!isGuard) return copriBustoFemminile(compatible, rules.sesso);
  // Le Guardie devono indossare sempre la Chainmail, anche se il catalogo
  // corporeo (es. Nano/child) richiede un fallback per altri strati.
  return copriBustoFemminile(normalizeCharacterAppearance({
    ...compatible,
    outfit: GUARD_CHAINMAIL_OUTFIT,
    upperOutfit: GUARD_CHAINMAIL_OUTFIT,
    sleeveOutfit: "none",
    fullOutfit: "none",
    fullOutfitTrim: "none",
    outfitPrimaryColor: "base"
  }), rules.sesso);
}
