import {
  appearanceForPublicSpace,
  bodyFamilyFor,
  dwarfChildOutfit,
  DWARF_BEARD_STYLE,
  ELF_EARS_STYLE,
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

export type RazzaGiocatore = "Umano" | "Elfo" | "Nano" | "Orco" | "Scheletro" | "Vampiro" | "Lucertoloide";
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
  /** Nuovo modello grafico-agnostico. Opzionale per compatibilità con i save precedenti. */
  characterAppearance?: CharacterAppearance;
};

const raceId = (razza: RazzaConAspetto): CharacterRaceId => ({
  Umano: "human", Elfo: "elf", Nano: "dwarf", Orco: "orc", Goblin: "goblin",
  Scheletro: "skeleton", Vampiro: "vampire", Lucertoloide: "lizard"
} satisfies Record<RazzaConAspetto, CharacterRaceId>)[razza];

export function testaObbligatoriaRazza(razza: RazzaConAspetto, sesso: "M" | "F" = "M"): string {
  if (razza === "Scheletro") return "skeleton";
  if (razza === "Vampiro") return "vampire";
  if (razza === "Goblin") return "goblin";
  if (razza === "Orco") return sesso === "F" ? "orc_female" : "orc_male";
  if (razza === "Lucertoloide") return sesso === "F" ? "lizard_female" : "lizard_male";
  return "human_head";
}

export function creaCharacterAppearance(razza: RazzaConAspetto, bodyType = "male"): CharacterAppearance {
  const race = raceId(razza);
  const effectiveBodyType = razza === "Nano" ? "child" : bodyType;
  const ageGroup = effectiveBodyType === "child" ? "child" : effectiveBodyType === "teen" ? "teen" : "adult";
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

export const COLORI_CAPELLI = ["#24170f", "#6b3f24", "#b06a32", "#dfbd65", "#b9bec8"];
export const COLORI_PELLE = ["#f2cfb0", "#e9b38f", "#bd795d", "#87513d", "#5a382c", "#79a86b"];

export const STILI_CAPELLI: StileCapelli[] = ["corti", "spettinati", "lunghi", "trecce"];
export const STILI_OCCHI: StileOcchi[] = ["tondi", "determinati", "allegri"];
export const VESTITI_PERSONAGGIO: VestitiPersonaggio[] = ["viandante", "nobile", "ranger", "mago"];
/** Copricapi assegnabili agli abitanti. La Corona è riservata al Re e resta fuori dal generatore. */
export const CAPPELLI_PERSONAGGIO: CappelloPersonaggio[] = ["nessuno", "nessuno", "cappuccio", "berretto"];

export const COLORI_VESTITI: Record<VestitiPersonaggio, { body: string; accent: string }> = {
  viandante: { body: "#8b5a2b", accent: "#d6b56f" },
  nobile: { body: "#7c2d3b", accent: "#e4b84c" },
  ranger: { body: "#315c3b", accent: "#9bb36a" },
  mago: { body: "#44306f", accent: "#9f8bd8" }
};

type RazzaConAspetto = RazzaGiocatore | "Goblin";

const pick = <T>(values: readonly T[], random: () => number): T =>
  values[Math.min(values.length - 1, Math.floor(random() * values.length))]!;

/** Crea un'identità visiva completa usando esattamente gli stessi pezzi disponibili nell'editor. */
export function generaAspettoCasuale(
  razza: RazzaConAspetto = "Umano",
  random: () => number = Math.random,
  contesto: { eta?: number; sesso?: "M" | "F"; professione?: string } = {}
): AspettoPersonaggio {
  const coloriPelle = razza === "Orco" || razza === "Goblin"
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
        : contesto.sesso === "F" ? "female" : "male";
  const baseAppearance = creaCharacterAppearance(razza, bodyType);
  const options = compatibleCatalogOptions(baseAppearance);
  const professione = contesto.professione?.toLocaleLowerCase("it") ?? "";
  const preferredOutfit = professione.includes("nobil") || professione.includes("ministr") || professione.includes("re")
    ? "noble"
    : professione.includes("guard") || professione.includes("soldat") || professione.includes("sicurezza") || professione.includes("giudic")
      ? "guard"
      : professione.includes("agric") || professione.includes("contadin")
        ? "farmer"
        : professione.includes("taglialegn") || professione.includes("boscai")
          ? "traveler"
          : undefined;
  const outfit = preferredOutfit && options.outfits.includes(preferredOutfit)
    ? preferredOutfit
    : options.outfits.length > 0 ? pick(options.outfits, random) : "none";
  const hairStyle = razza === "Nano"
    ? "none"
    : options.hairStyles.length > 0 ? pick(options.hairStyles, random) : "none";
  const dwarfBeardColors = razza === "Nano"
    ? compatibleColorsForField({ ...baseAppearance, beardStyle: DWARF_BEARD_STYLE }, "beardColor", "beard", DWARF_BEARD_STYLE)
    : [];
  const beardStyle = razza === "Nano"
    ? DWARF_BEARD_STYLE
    : bodyType === "male" && options.beardStyles.length > 1 && random() > 0.55
      ? pick(options.beardStyles.filter((value) => value !== "none"), random)
      : "none";
  const dwarfClothes = razza === "Nano"
    ? dwarfChildOutfit(contesto.sesso, Math.floor(random() * 1_000_000) + 1)
    : null;
  const characterAppearance = normalizeCharacterAppearance({
    ...baseAppearance,
    skinTone: options.skinTones.length > 0 ? pick(options.skinTones, random) : baseAppearance.skinTone,
    hairStyle,
    hairColor: razza === "Nano"
      ? "none"
      : options.hairColors.length > 0 ? pick(options.hairColors, random) : baseAppearance.hairColor,
    beardStyle,
    beardColor: razza === "Nano"
      ? (dwarfBeardColors.length > 0 ? pick(dwarfBeardColors, random) : baseAppearance.beardColor)
      : options.hairColors.length > 0 ? pick(options.hairColors, random) : baseAppearance.beardColor,
    ...(dwarfClothes ?? {
      outfit,
      upperOutfit: outfit,
      lowerOutfit: outfit,
      outfitPrimaryColor: options.outfitPrimaryColors.length > 0 ? pick(options.outfitPrimaryColors, random) : baseAppearance.outfitPrimaryColor,
      outfitSecondaryColor: options.outfitSecondaryColors.length > 0 ? pick(options.outfitSecondaryColors, random) : baseAppearance.outfitSecondaryColor,
      footwear: baseAppearance.footwear
    }),
    footwearColor: options.footwearColors.length > 0 ? pick(options.footwearColors, random) : baseAppearance.footwearColor,
    headwear: razza === "Nano" ? "none" : options.headwear.length > 0 ? pick(options.headwear, random) : "none",
    accessory: !dwarfClothes && (outfit === "farmer" || professione.includes("agric")) ? FARMER_TOOL : "none"
  });

  const aspetto: AspettoPersonaggio = {
    coloreCapelli: pick(COLORI_CAPELLI, random),
    stileCapelli: pick(STILI_CAPELLI, random),
    stileOcchi: pick(STILI_OCCHI, random),
    colorePelle: pick(coloriPelle, random),
    vestiti: pick(VESTITI_PERSONAGGIO, random),
    cappello: pick(cappelli, random),
    characterAppearance
  };
  if (professione.includes("capo religioso")) {
    return applicaAspettoCapoReligioso(aspetto, random);
  }
  if (professione.includes("consigliere")) {
    return creaAspettoConsigliereIniziale();
  }
  return aspetto;
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
 * Aspetto da mostrare in UI/mappa: garantisce uno sprite LPC renderizzabile
 * (i Nani senza characterAppearance o con outfit adult cadevano nel vecchio CSS).
 */
export function aspettoPerVisualizzazioneAbitante(
  abitante: {
    id: number;
    razza?: string | null;
    aspetto?: AspettoPersonaggio;
    lavoro?: string;
    incinta?: boolean;
    sesso?: "M" | "F" | null;
  },
  rules: { nudismoAttivo?: boolean } = {}
): AspettoPersonaggio | undefined {
  if (abitante.razza === "Golem") return abitante.aspetto;
  const razza = (abitante.razza ?? "Umano") as RazzaConAspetto;
  let aspetto = abitante.aspetto;
  if (!aspetto?.characterAppearance) {
    const generato = generaAspettoDaSeed(razza, abitante.id, {
      sesso: abitante.sesso === "M" || abitante.sesso === "F" ? abitante.sesso : undefined
    });
    aspetto = aspetto ? { ...aspetto, characterAppearance: generato.characterAppearance } : generato;
  }
  if (!aspetto.characterAppearance) return aspetto;
  return {
    ...aspetto,
    characterAppearance: appearanceForPublicSpace(aspetto.characterAppearance, {
      isKing: abitante.id === 1,
      nudismoAttivo: rules.nudismoAttivo === true,
      incinta: abitante.incinta === true,
      lavoro: abitante.lavoro,
      seed: abitante.id,
      razza: abitante.razza,
      sesso: abitante.sesso
    })
  };
}

/** Aspetto dimostrativo per la pagina Razze: regole visive coerenti con LPC. */
export function generaAspettoEsempioRazza(razza: RazzaConAspetto, seed: number): AspettoPersonaggio {
  const base = generaAspettoDaSeed(razza, seed);
  const corrente = base.characterAppearance ?? creaCharacterAppearance(razza, "male");
  const conCapelli = razza === "Umano" || razza === "Vampiro";

  let appearance = normalizeCharacterAppearance({
    ...corrente,
    race: raceId(razza),
    headStyle: testaObbligatoriaRazza(razza, "M"),
    hairStyle: conCapelli ? corrente.hairStyle : "none",
    hairColor: conCapelli ? corrente.hairColor : "none",
    beardStyle: "none"
  });

  if (razza === "Scheletro") {
    appearance = normalizeCharacterAppearance({
      ...appearance,
      race: "skeleton",
      bodyType: "skeleton",
      ageGroup: "adult",
      bodyFamily: bodyFamilyFor("skeleton", "adult"),
      headStyle: "skeleton",
      skinTone: "base",
      outfit: "none",
      upperOutfit: "none",
      lowerOutfit: "none",
      fullOutfit: "none",
      footwear: "none",
      headwear: "none"
    });
  } else if (razza === "Nano") {
    const female = (seed % 2) === 0;
    appearance = normalizeCharacterAppearance({
      ...appearance,
      race: "dwarf",
      bodyType: "child",
      ageGroup: "child",
      bodyFamily: bodyFamilyFor("dwarf", "child"),
      headStyle: "human_head",
      hairStyle: "none",
      hairColor: "none",
      beardStyle: DWARF_BEARD_STYLE,
      ...dwarfChildOutfit(female ? "F" : "M", seed)
    });
  } else if (razza === "Elfo") {
    appearance = normalizeCharacterAppearance({
      ...appearance,
      race: "elf",
      headStyle: "human_head",
      earsStyle: ELF_EARS_STYLE
    });
  } else if (razza === "Orco") {
    appearance = normalizeCharacterAppearance({
      ...appearance,
      race: "orc",
      bodyType: "muscular",
      ageGroup: "adult",
      bodyFamily: bodyFamilyFor("orc", "adult"),
      headStyle: "orc_male",
      outfit: "none",
      upperOutfit: "none",
      lowerOutfit: "none",
      fullOutfit: "none",
      footwear: "none",
      headwear: "none"
    });
  } else if (!conCapelli) {
    appearance = normalizeCharacterAppearance({
      ...appearance,
      hairStyle: "none",
      hairColor: "none",
      beardStyle: "none"
    });
  }

  if (!canRenderCharacter(appearance, "idle")) {
    return base;
  }
  return { ...base, characterAppearance: appearance };
}

/** Kimono LPC disponibile solo sul bodyType teen (i Nani restano sul corpo child). */
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
    : firstCompatibleColorForField(teenAppearance, "outfitPrimaryColor", "fullOutfit", "kimono");
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

/**
 * Aspetto fisso del Consigliere iniziale: uomo di 60 anni, pelato,
 * Body Color Light, Basic Beard White.
 * Non usato quando il giocatore nomina un altro Consigliere in seguito.
 */
export const CONSIGLIERE_ETA_INIZIALE = 60;
export const CONSIGLIERE_BEARD_STYLE = "basic";
export const CONSIGLIERE_BEARD_COLOR = "white";
export const CONSIGLIERE_SKIN_TONE = "light";
export const CONSIGLIERE_HAIR_STYLE = "none";

/** Aspetto completo e deterministico per il Consigliere di inizio partita. */
export function creaAspettoConsigliereIniziale(): AspettoPersonaggio {
  const characterAppearance = normalizeCharacterAppearance({
    ...creaCharacterAppearance("Umano", "male"),
    race: "human",
    bodyType: "male",
    ageGroup: "adult",
    bodyFamily: bodyFamilyFor("human", "adult"),
    headStyle: "human_head",
    skinTone: CONSIGLIERE_SKIN_TONE,
    hairStyle: CONSIGLIERE_HAIR_STYLE,
    hairColor: "none",
    beardStyle: CONSIGLIERE_BEARD_STYLE,
    beardColor: CONSIGLIERE_BEARD_COLOR,
    outfit: "commoner",
    upperOutfit: "commoner",
    lowerOutfit: "commoner",
    fullOutfit: "none",
    headwear: "none",
    accessory: "none"
  });
  return {
    coloreCapelli: "#b9bec8",
    stileCapelli: "corti",
    stileOcchi: "tondi",
    colorePelle: COLORI_PELLE[0]!,
    vestiti: "nobile",
    cappello: "nessuno",
    characterAppearance
  };
}

/** @deprecated Usa {@link creaAspettoConsigliereIniziale}. */
export function applicaAspettoConsigliereIniziale(_aspetto?: AspettoPersonaggio): AspettoPersonaggio {
  return creaAspettoConsigliereIniziale();
}

function randomFromId(id: number): () => number {
  let state = (id >>> 0) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function aspettoCapoReligiosoSeNecessario(
  aspetto: AspettoPersonaggio | undefined,
  id: number
): AspettoPersonaggio | undefined {
  if (!aspetto) return aspetto;
  if (aspetto.characterAppearance?.fullOutfit === "kimono") return aspetto;
  return applicaAspettoCapoReligioso(aspetto, randomFromId(id));
}
