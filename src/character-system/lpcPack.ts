import type {
  CharacterAnimationId,
  CharacterAssetDefinition,
  CharacterDirection,
  CharacterRaceId,
  SpriteSheetDefinition
} from "./types";

export const LPC_PACK_ID = "lpc";
export const LPC_HUMAN_MALE_BODY_ID = "body_human_male_adult_light";

/** ULPC split-animation exports: 13 columns, rows ordered up/left/down/right. */
export const LPC_DIRECTION_ROWS: Record<CharacterDirection, number> = {
  up: 0,
  left: 1,
  down: 2,
  right: 3
};

export const LPC_SHEETS: Record<string, SpriteSheetDefinition> = {
  "lpc-human-male-idle": {
    id: "lpc-human-male-idle",
    frameWidth: 64,
    frameHeight: 64,
    columns: 13,
    rows: 4,
    animations: {
      idle: {
        sheetId: "lpc-human-male-idle",
        frames: 2,
        columns: [0, 1],
        frameDurationMs: 500,
        loop: true,
        directionRows: LPC_DIRECTION_ROWS
      }
    }
  },
  "lpc-human-male-walk": {
    id: "lpc-human-male-walk",
    frameWidth: 64,
    frameHeight: 64,
    columns: 13,
    rows: 4,
    animations: {
      walk: {
        sheetId: "lpc-human-male-walk",
        frames: 9,
        columns: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        frameDurationMs: 100,
        loop: true,
        directionRows: LPC_DIRECTION_ROWS
      }
    }
  }
};

export function generatedLpcSheet(animation: CharacterAnimationId): SpriteSheetDefinition | undefined {
  if (animation !== "idle" && animation !== "walk") return undefined;
  const frames = animation === "idle" ? 2 : 9;
  return {
    id: `lpc-generated-${animation}`,
    frameWidth: 64,
    frameHeight: 64,
    columns: frames,
    rows: 4,
    animations: {
      [animation]: {
        sheetId: `lpc-generated-${animation}`,
        frames,
        columns: Array.from({ length: frames }, (_, index) => index),
        frameDurationMs: animation === "idle" ? 500 : 100,
        loop: true,
        directionRows: LPC_DIRECTION_ROWS
      }
    }
  };
}

export const LPC_ASSETS: readonly CharacterAssetDefinition[] = [
  {
    id: LPC_HUMAN_MALE_BODY_ID,
    assetPack: LPC_PACK_ID,
    layer: "body",
    bodyFamilies: ["humanAdult"],
    races: ["human"],
    sheetId: "lpc-human-male-idle",
    sourceId: "lpc-human-male-composite",
    tint: "none",
    attributionId: "lpc-human-male-adult-2026-08-31"
  }
];

export function lpcSheetForAnimation(animation: CharacterAnimationId): SpriteSheetDefinition | undefined {
  return LPC_SHEETS[`lpc-human-male-${animation}`];
}

export function lpcRaceId(race: string): CharacterRaceId | undefined {
  return ({ Umano: "human", Elfo: "elf", Nano: "dwarf", Orco: "orc", Goblin: "halfling" } as const)[race as "Umano"];
}
