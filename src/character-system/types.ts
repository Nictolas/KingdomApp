export type CharacterRaceId = "human" | "elf" | "dwarf" | "halfling" | "orc";
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
  | "raceFeatures"
  | "beard"
  | "hairFront"
  | "headwear"
  | "accessory";

/** Dati persistibili: solo ID semantici, mai path o coordinate di sprite. */
export type CharacterAppearance = {
  race: CharacterRaceId;
  bodyType: string;
  bodyFamily: CharacterBodyFamily;
  ageGroup: CharacterAgeGroup;
  skinTone: string;
  eyeColor: string;
  hairStyle: string;
  hairColor: string;
  beardStyle: string;
  beardColor: string;
  outfit: string;
  outfitPrimaryColor: string;
  outfitSecondaryColor: string;
  footwear: string;
  headwear: string;
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
  bodyFamilies: readonly CharacterBodyFamily[];
  races: readonly CharacterRaceId[];
  sheetId: string;
  sourceId: string;
  tint: "none" | "palette-swap";
  attributionId: string;
};

export type ResolvedCharacterLayer = CharacterAssetDefinition & {
  sheet: SpriteSheetDefinition;
};
