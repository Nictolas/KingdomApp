export type CharacterRaceId = "human" | "elf" | "dwarf" | "halfling" | "orc" | "skeleton" | "vampire" | "goblin" | "lizard";
export type CharacterAgeGroup = "adult" | "teen" | "child";
export type CharacterBodyFamily =
  | "humanAdult"
  | "elfAdult"
  | "dwarfAdult"
  | "halflingAdult"
  | "orcAdult"
  | "humanTeen"
  | "humanChild";
export type CharacterDirection = "down" | "left" | "right" | "up";
export type CharacterAnimationId = "idle" | "walk" | (string & {});
export type CharacterLayer =
  | "hairBack"
  | "body"
  | "lowerBody"
  | "outfit"
  | "fullOutfit"
  | "footwear"
  | "raceFeatures"
  | "ears"
  | "beard"
  | "hairFront"
  | "headwear"
  | "neck"
  | "facialMask"
  | "facialEyes"
  | "cape"
  | "accessory";

/** Dati persistibili: solo ID semantici, mai path o coordinate di sprite. */
export type CharacterAppearance = {
  race: CharacterRaceId;
  bodyType: string;
  bodyFamily: CharacterBodyFamily;
  ageGroup: CharacterAgeGroup;
  skinTone: string;
  headStyle: string;
  eyeColor: string;
  hairStyle: string;
  hairColor: string;
  beardStyle: string;
  beardColor: string;
  /** Orecchie LPC (es. side_wolf_skintone per gli Elfi). */
  earsStyle: string;
  /** Identificatore storico del completo; resta per compatibilità con i salvataggi precedenti. */
  outfit: string;
  upperOutfit: string;
  lowerOutfit: string;
  fullOutfit: string;
  /** Rifinitura LPC sovrapposta all'abito (es. kimono_trim su kimono). */
  fullOutfitTrim: string;
  outfitPrimaryColor: string;
  outfitSecondaryColor: string;
  footwear: string;
  /** Colore LPC per scarpe/stivali (colorField manifest: footwear). */
  footwearColor: string;
  headwear: string;
  /** Colore LPC per copricapo (es. Mail hood → iron). */
  headwearColor: string;
  /** Cravat / neck LPC (es. Medico). */
  neckwear: string;
  neckwearColor: string;
  /** Plain Mask LPC (es. Medico). */
  facialMask: string;
  facialMaskColor: string;
  /** Sunglasses LPC (es. Medico). */
  facialEyes: string;
  facialEyesColor: string;
  cape: string;
  capeTrim: string;
  capeColor: string;
  accessory: string;
};

export type SpriteAnimationDefinition = {
  sheetId: string;
  frames: number;
  frameDurationMs: number;
  loop: boolean;
  directionRows: Record<CharacterDirection, number>;
  columns?: readonly number[];
};

export type SpriteSheetDefinition = {
  id: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  animations: Record<string, SpriteAnimationDefinition>;
};

export type CharacterAssetDefinition = {
  id: string;
  assetPack: string;
  layer: CharacterLayer;
  semanticId: string;
  bodyFamilies: readonly CharacterBodyFamily[];
  races: readonly CharacterRaceId[];
  sheetId: string;
  sourceId: string;
  tint: "none" | "palette-swap";
  attributionId: string;
};

export type ResolvedCharacterLayer = CharacterAssetDefinition & {
  sheet: SpriteSheetDefinition;
  zPos: number;
};
