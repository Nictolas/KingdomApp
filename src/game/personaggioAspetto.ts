import {
  appearanceForPublicSpace,
  copriBustoFemminile,
  bodyFamilyFor,
  DWARF_BEARD_STYLE,
  FARMER_TOOL,
  normalizeCharacterAppearance
} from "../character-system/appearance";
import {
  canRenderCharacter,
  compatibleCatalogOptions,
  compatibleColorsForField,
  firstCompatibleColorForField,
  firstCompatibleHairColor
} from "../character-system/registry";
import type { CharacterAppearance, CharacterRaceId } from "../character-system/types";

export type RazzaGiocatore = "Umano" | "Elfo" | "Nano" | "Orco";
export type StileCapelli = "corti" | "spettinati" | "lunghi" | "trecce";
export type StileOcchi = "tondi" | "determinati" | "allegri";
export type VestitiPersonaggio = "viandante" | "nobile" | "ranger" | "mago";
export type CappelloPersonaggio = "nessuno" | "cappuccio" | "berretto" | "corona";

export type AspettoPersonaggio = {
  coloreCapelli: string;
  stileCapelli: StileCapelli;
  stileOcchi: StileOcchi;
  colorePelle: string;
  vestiti: VestitiPersonaggio;
  cappello: CappelloPersonaggio;
  /** Modello semantico LPC. Opzionale per compatibilità con salvataggi precedenti. */
  characterAppearance?: CharacterAppearance;
};

type RazzaConAspetto = RazzaGiocatore | "Goblin";

const raceId = (razza: RazzaConAspetto): CharacterRaceId =>
  ({
    Umano: "human",
    Elfo: "elf",
    Nano: "dwarf",
    Orco: "orc",
    Goblin: "goblin"
  } satisfies Record<RazzaConAspetto, CharacterRaceId>)[razza];

export function testaObbligatoriaRazza(razza: RazzaConAspetto, sesso: "M" | "F" = "M"): string {
  if (razza === "Goblin") return "goblin";
  if (razza === "Orco") return sesso === "F" ? "orc_female" : "orc_male";
  return "human_head";
}

export function creaCharacterAppearance(
  razza: RazzaConAspetto,
  bodyType = "male"
): CharacterAppearance {
  const race = raceId(razza);
  const effectiveBodyType = razza === "Nano" ? "child" : bodyType;
  const ageGroup =
    effectiveBodyType === "child" ? "child" :
    effectiveBodyType === "teen" ? "teen" :
    "adult";

  return normalizeCharacterAppearance({
    race,
    bodyType: effectiveBodyType,
    ageGroup,
    bodyFamily: bodyFamilyFor(race, ageGroup),
    headStyle: testaObbligatoriaRazza(razza, effectiveBodyType === "female" ? "F" : "M"),
    hairStyle: effectiveBodyType === "child" ? "relm_short" : "messy",
    hairColor: "dark_brown",
    beardStyle: razza === "Nano" ? DWARF_BEARD_STYLE : "none",
    beardColor: "dark_brown",
    outfit: "commoner",
    upperOutfit: "commoner",
    lowerOutfit: "commoner",
    fullOutfit: "none",
    headwear: "none"
  });
}

export const ASPETTO_GIOCATORE_DEFAULT: AspettoPersonaggio = {
  coloreCapelli: "#6b3f24",
  stileCapelli: "spettinati",
  stileOcchi: "tondi",
  colorePelle: "#e9b38f",
  vestiti: "viandante",
  cappello: "nessuno",
  characterAppearance: creaCharacterAppearance("Umano")
};

/** Verde standard degli orchi (compatibile con la palette LPC della testa). */
export const COLORE_PELLE_ORCO = "#39aa4e";

/** Aggiorna anche i vecchi salvataggi in memoria senza toccare vestiti o tratti. */
export function normalizzaAspettoOrco(aspetto: AspettoPersonaggio): AspettoPersonaggio {
  return {
    ...aspetto,
    colorePelle: COLORE_PELLE_ORCO,
    ...(aspetto.characterAppearance ? {
      characterAppearance: normalizeCharacterAppearance({
        ...aspetto.characterAppearance,
        race: "orc"
      })
    } : {})
  };
}

export const COLORI_CAPELLI = ["#24170f", "#6b3f24", "#b06a32", "#dfbd65", "#b9bec8"];
export const COLORI_PELLE = ["#f2cfb0", "#e9b38f", "#bd795d", "#87513d", "#5a382c", "#79a86b"];

export const STILI_CAPELLI: StileCapelli[] = ["corti", "spettinati", "lunghi", "trecce"];
export const STILI_OCCHI: StileOcchi[] = ["tondi", "determinati", "allegri"];
export const VESTITI_PERSONAGGIO: VestitiPersonaggio[] = ["viandante", "nobile", "ranger", "mago"];
/** Copricapi legacy assegnabili agli abitanti. La Corona è riservata al Re. */
export const CAPPELLI_PERSONAGGIO: CappelloPersonaggio[] = ["nessuno", "nessuno", "cappuccio", "berretto"];

export const COLORI_VESTITI: Record<VestitiPersonaggio, { body: string; accent: string }> = {
  viandante: { body: "#8b5a2b", accent: "#d6b56f" },
  nobile: { body: "#7c2d3b", accent: "#e4b84c" },
  ranger: { body: "#315c3b", accent: "#9bb36a" },
  mago: { body: "#44306f", accent: "#9f8bd8" }
};

const pick = <T>(values: readonly T[], random: () => number): T =>
  values[Math.min(values.length - 1, Math.floor(random() * values.length))]!;

/** Crea un'identità visiva completa usando il catalogo LPC quando disponibile. */
export function generaAspettoCasuale(
  razza: RazzaConAspetto = "Umano",
  random: () => number = Math.random,
  contesto: { eta?: number; sesso?: "M" | "F"; professione?: string } = {}
): AspettoPersonaggio {
  const coloriPelle = razza === "Orco"
    ? [COLORE_PELLE_ORCO]
    : razza === "Goblin"
      ? ["#79a86b", "#668f58", "#8aa66b"]
      : COLORI_PELLE.filter((color) => color !== "#79a86b");
  const cappelli = razza === "Nano"
    ? ["nessuno", "berretto", "cappuccio"] as const
    : CAPPELLI_PERSONAGGIO;

  const bodyType = razza === "Nano"
    ? "child"
    : contesto.eta != null && contesto.eta < 13
      ? "child"
      : contesto.eta != null && contesto.eta < 18
        ? "teen"
        : contesto.sesso === "F"
          ? "female"
          : "male";

  const baseAppearance = creaCharacterAppearance(razza, bodyType);
  const options = compatibleCatalogOptions(baseAppearance);
  const professione = contesto.professione?.toLocaleLowerCase("it") ?? "";
  const preferredOutfit =
    professione.includes("nobil") || professione.includes("ministr") || professione === "re"
      ? "noble"
      : professione.includes("guard") || professione.includes("soldat") || professione.includes("sicurezza")
        ? "guard"
        : professione.includes("agric") || professione.includes("contadin")
          ? "farmer"
          : undefined;

  const commonOutfits = options.outfits;
  const outfit = preferredOutfit && commonOutfits.includes(preferredOutfit)
    ? preferredOutfit
    : commonOutfits.length > 0
      ? pick(commonOutfits, random)
      : "none";

  const hairStyle = options.hairStyles.length > 0 ? pick(options.hairStyles, random) : "none";
  const appearanceWithHair = normalizeCharacterAppearance({ ...baseAppearance, hairStyle });
  const hairColors = compatibleCatalogOptions(appearanceWithHair).hairColors;
  const hairColor = hairColors.length > 0
    ? pick(hairColors, random)
    : firstCompatibleHairColor(baseAppearance, hairStyle);

  const dwarfBeardColors = razza === "Nano"
    ? compatibleColorsForField(
        { ...baseAppearance, beardStyle: DWARF_BEARD_STYLE },
        "beardColor",
        "beard",
        DWARF_BEARD_STYLE
      )
    : [];

  const beardStyle = razza === "Nano"
    ? DWARF_BEARD_STYLE
    : bodyType === "male" && options.beardStyles.length > 1 && random() > 0.55
      ? pick(options.beardStyles.filter((value) => value !== "none"), random)
      : "none";

  const outfitPrimaryColor = outfit === "none"
    ? baseAppearance.outfitPrimaryColor
    : firstCompatibleColorForField(baseAppearance, "outfitPrimaryColor", "outfit", outfit);
  const outfitSecondaryColor = outfit === "none"
    ? baseAppearance.outfitSecondaryColor
    : firstCompatibleColorForField(baseAppearance, "outfitSecondaryColor", "lowerBody", outfit);

  const characterAppearance = normalizeCharacterAppearance({
    ...baseAppearance,
    skinTone: options.skinTones.length > 0 ? pick(options.skinTones, random) : baseAppearance.skinTone,
    hairStyle,
    hairColor,
    beardStyle,
    beardColor: razza === "Nano"
      ? (dwarfBeardColors.length > 0 ? pick(dwarfBeardColors, random) : hairColor)
      : hairColor,
    outfit,
    upperOutfit: outfit,
    lowerOutfit: outfit,
    outfitPrimaryColor,
    outfitSecondaryColor,
    footwearColor: options.footwearColors.length > 0
      ? pick(options.footwearColors, random)
      : baseAppearance.footwearColor,
    headwear: options.headwear.length > 0 ? pick(options.headwear, random) : "none",
    accessory: outfit === "farmer" || professione.includes("agric") ? FARMER_TOOL : "none"
  });

  return {
    coloreCapelli: pick(COLORI_CAPELLI, random),
    stileCapelli: pick(STILI_CAPELLI, random),
    stileOcchi: pick(STILI_OCCHI, random),
    colorePelle: pick(coloriPelle, random),
    vestiti: pick(VESTITI_PERSONAGGIO, random),
    cappello: pick(cappelli, random),
    characterAppearance
  };
}

/** Aspetto LPC del Capo Religioso/Sacerdote: kimono compatibile col corpo. */
export function applicaAspettoCapoReligioso(
  aspetto: AspettoPersonaggio,
  random: () => number = Math.random
): AspettoPersonaggio {
  const current = aspetto.characterAppearance;
  if (!current) return aspetto;

  const isNano = current.race === "dwarf";
  const bodyPatch = isNano
    ? {
        bodyType: "child" as const,
        ageGroup: "child" as const,
        bodyFamily: bodyFamilyFor("dwarf", "child"),
        beardStyle: DWARF_BEARD_STYLE
      }
    : {
        bodyType: "teen" as const,
        ageGroup: "teen" as const,
        bodyFamily: bodyFamilyFor(current.race, "teen")
      };

  const teenAppearance = normalizeCharacterAppearance({
    ...current,
    ...bodyPatch,
    fullOutfit: "kimono",
    outfit: "kimono",
    upperOutfit: "none",
    lowerOutfit: "none",
    footwear: "none",
    headwear: "none"
  });
  const options = compatibleCatalogOptions(teenAppearance);
  const hairStyle = options.hairStyles.includes(teenAppearance.hairStyle)
    ? teenAppearance.hairStyle
    : options.hairStyles.length > 0
      ? pick(options.hairStyles, random)
      : "none";
  const hairColor = options.hairColors.includes(teenAppearance.hairColor)
    ? teenAppearance.hairColor
    : firstCompatibleHairColor({ ...teenAppearance, hairStyle }, hairStyle);
  const beardStyle = isNano
    ? DWARF_BEARD_STYLE
    : options.beardStyles.includes(teenAppearance.beardStyle)
      ? teenAppearance.beardStyle
      : "none";
  const outfitPrimaryColor = options.outfitPrimaryColors.length > 0
    ? pick(options.outfitPrimaryColors, random)
    : firstCompatibleColorForField(
        teenAppearance,
        "outfitPrimaryColor",
        "fullOutfit",
        "kimono"
      );
  const characterAppearance = normalizeCharacterAppearance({
    ...teenAppearance,
    hairStyle,
    hairColor,
    beardStyle,
    beardColor: isNano ? teenAppearance.beardColor : hairColor,
    outfitPrimaryColor
  });
  if (!canRenderCharacter(characterAppearance, "idle")) return aspetto;
  return { ...aspetto, characterAppearance };
}

/** Variante stabile per completare vecchi salvataggi senza cambiare volto a ogni caricamento. */
export function generaAspettoDaSeed(
  razza: RazzaConAspetto,
  seed: number,
  contesto: { sesso?: "M" | "F" } = {}
): AspettoPersonaggio {
  let state = (seed >>> 0) || 1;
  return generaAspettoCasuale(
    razza,
    () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    },
    contesto
  );
}


/**
 * Aspetto usato da mappa/UI: completa i vecchi salvataggi con un LPC stabile
 * e applica le regole dell'abbigliamento pubblico senza mutare il salvataggio.
 */
export function aspettoPerVisualizzazioneAbitante(
  abitante: {
    id: number;
    eta?: number;
    razza?: string | null;
    aspetto?: AspettoPersonaggio;
    lavoro?: string;
    incinta?: boolean;
    sesso?: "M" | "F" | null;
  },
  rules: { nudismoAttivo?: boolean } = {}
): AspettoPersonaggio | undefined {
  if (abitante.razza === "Golem") return abitante.aspetto;

  const razzeSupportate: readonly RazzaConAspetto[] = ["Umano", "Elfo", "Nano", "Orco", "Goblin"];
  const razza = razzeSupportate.includes(abitante.razza as RazzaConAspetto)
    ? (abitante.razza as RazzaConAspetto)
    : "Umano";

  let aspetto = abitante.aspetto;
  if (!aspetto?.characterAppearance) {
    const generato = generaAspettoDaSeed(razza, abitante.id, {
      sesso: abitante.sesso === "M" || abitante.sesso === "F" ? abitante.sesso : undefined
    });
    aspetto = aspetto ? { ...aspetto, characterAppearance: generato.characterAppearance } : generato;
  }
  const currentAppearance = aspetto.characterAppearance;
  if (!currentAppearance) return aspetto;
  // Anche gli aspetti legacy già salvati non devono mai mostrare pelle umana.
  if (razza === "Orco") aspetto = normalizzaAspettoOrco(aspetto);

  const pubblico = appearanceForPublicSpace(currentAppearance, {
    isKing: abitante.id === 1,
    nudismoAttivo: rules.nudismoAttivo === true,
    incinta: abitante.incinta === true,
    lavoro: abitante.lavoro,
    seed: abitante.id,
    razza: abitante.razza,
    sesso: abitante.sesso
  });

  // Il corpo cambia con gli anni, senza rigenerare pelle/colore/vestiti e
  // senza mutare l'aspetto memorizzato nei vecchi salvataggi.
  const eta = abitante.eta;
  if (eta == null) return { ...aspetto, characterAppearance: copriBustoFemminile(pubblico, abitante.sesso) };
  const bodyType = razza === "Nano" ? "child"
    : eta < 13 ? "child"
    : eta < 18 ? "teen"
    : abitante.sesso === "F" ? "female" : "male";
  const ageGroup = bodyType === "child" ? "child" : bodyType === "teen" ? "teen" : "adult";
  if (pubblico.bodyType === bodyType && pubblico.ageGroup === ageGroup) {
    return { ...aspetto, characterAppearance: copriBustoFemminile(pubblico, abitante.sesso) };
  }
  const aggiornato = normalizeCharacterAppearance({
    ...pubblico, bodyType, ageGroup, bodyFamily: bodyFamilyFor(pubblico.race, ageGroup)
  });
  const finale = canRenderCharacter(aggiornato, "idle") ? aggiornato : pubblico;
  return { ...aspetto, characterAppearance: copriBustoFemminile(finale, abitante.sesso) };
}
