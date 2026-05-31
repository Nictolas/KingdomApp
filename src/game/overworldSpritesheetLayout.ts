import {
  pickBestSpiaggiaAssetForWaterMask,
  type ErbaExtraDecorKind,
  type ErbaSpiaggiaTileAsset1x1,
  type ErbaTileAsset1x1,
  type SpiaggiaTileAsset1x1,
  type StradaTileAsset1x1
} from "./terrainSpriteHelpers";

/**
 * Coordinate in pixel sul file spritesheet-full.png (RhosGFX DEMO, 1341×1408).
 * Tile base 64×64.
 */
export const OVERWORLD_SHEET_PX = {
  w: 1341,
  h: 1408,
  tile: 64,
  /** Striscia acqua animata: 4 frame orizzontali */
  waterAnimX: 768,
  waterAnimY: 64,
  waterFrames: 4
} as const;

export type SheetCoord = { x: number; y: number };

const ERBA: Record<ErbaTileAsset1x1, SheetCoord> = {
  centro: { x: 64, y: 128 },
  campo_nord_est: { x: 128, y: 128 }
};

const SPIAGGIA: Record<SpiaggiaTileAsset1x1, SheetCoord> = {
  nord: { x: 832, y: 128 },
  sud: { x: 832, y: 256 },
  est: { x: 896, y: 192 },
  ovest: { x: 768, y: 192 },
  nord_est: { x: 896, y: 128 },
  nord_ovest: { x: 768, y: 128 },
  sud_est: { x: 896, y: 256 },
  sud_ovest: { x: 768, y: 256 },
  centro: { x: 832, y: 192 }
};

const ERBA_SPIAGGIA: Record<ErbaSpiaggiaTileAsset1x1, SheetCoord> = {
  nord: { x: 384, y: 128 },
  sud: { x: 384, y: 256 },
  est: { x: 448, y: 192 },
  ovest: { x: 320, y: 192 },
  nord_est: { x: 448, y: 128 },
  nord_ovest: { x: 320, y: 128 },
  sud_est: { x: 448, y: 256 },
  sud_ovest: { x: 320, y: 256 }
};

/**
 * Strade / sentieri: blocco autotile erba↔path (~128–448, 128–384 sullo sheet).
 * Maschera = lati con erba (vicino non-strada), come in {@link getRoadDirtSubtile}.
 */
const STRADA_SHEET_BY_GRASS_MASK: Partial<Record<number, SheetCoord>> = {
  0: { x: 192, y: 192 },
  1: { x: 192, y: 128 },
  2: { x: 256, y: 192 },
  3: { x: 256, y: 128 },
  4: { x: 192, y: 256 },
  6: { x: 256, y: 256 },
  8: { x: 128, y: 192 },
  9: { x: 128, y: 128 },
  10: { x: 64, y: 768 },
  12: { x: 128, y: 256 },
  14: { x: 64, y: 512 },
  15: { x: 256, y: 320 }
};

const STRADA_ASSET_GRASS_MASK: Record<StradaTileAsset1x1, number> = {
  orizzontale: 5,
  verticale: 10,
  nord: 14,
  sud: 11,
  est: 13,
  ovest: 7,
  curva_nord_est: 12,
  curva_nord_ovest: 6,
  curva_sud_est: 9,
  curva_sud_ovest: 3,
  incrocio_nord_est_ovest: 4,
  incrocio_nord_est_sud: 8,
  incrocio_est_sud_ovest: 1,
  incrocio_est_sud_nord: 2,
  incrocio_centro: 0,
  centro: 0,
  generica: 15
};

function popcountMask(mask: number): number {
  let n = 0;
  for (let m = mask; m; m >>= 1) n += m & 1;
  return n;
}

function pickBestStradaSheetCoordForGrassMask(mask: number): SheetCoord {
  const exact = STRADA_SHEET_BY_GRASS_MASK[mask];
  if (exact != null) return exact;

  let bestCoord = STRADA_SHEET_BY_GRASS_MASK[0] ?? { x: 192, y: 192 };
  let bestScore = -1;
  for (const [tileMaskStr, coord] of Object.entries(STRADA_SHEET_BY_GRASS_MASK)) {
    const tileMask = Number(tileMaskStr);
    const correct = popcountMask(mask & tileMask);
    const wrong = popcountMask(tileMask & ~mask);
    const score = correct * 10 - wrong * 100 + popcountMask(tileMask);
    if (score > bestScore) {
      bestScore = score;
      bestCoord = coord;
    }
  }
  return bestCoord;
}

const STRADA: Record<StradaTileAsset1x1, SheetCoord> = {
  orizzontale: pickBestStradaSheetCoordForGrassMask(5),
  verticale: pickBestStradaSheetCoordForGrassMask(10),
  nord: pickBestStradaSheetCoordForGrassMask(14),
  sud: pickBestStradaSheetCoordForGrassMask(11),
  est: pickBestStradaSheetCoordForGrassMask(13),
  ovest: pickBestStradaSheetCoordForGrassMask(7),
  curva_nord_est: pickBestStradaSheetCoordForGrassMask(12),
  curva_nord_ovest: pickBestStradaSheetCoordForGrassMask(6),
  curva_sud_est: pickBestStradaSheetCoordForGrassMask(9),
  curva_sud_ovest: pickBestStradaSheetCoordForGrassMask(3),
  incrocio_nord_est_ovest: pickBestStradaSheetCoordForGrassMask(4),
  incrocio_nord_est_sud: pickBestStradaSheetCoordForGrassMask(8),
  incrocio_est_sud_ovest: pickBestStradaSheetCoordForGrassMask(1),
  incrocio_est_sud_nord: pickBestStradaSheetCoordForGrassMask(2),
  incrocio_centro: pickBestStradaSheetCoordForGrassMask(0),
  centro: pickBestStradaSheetCoordForGrassMask(0),
  generica: pickBestStradaSheetCoordForGrassMask(15)
};

const DECOR: Record<ErbaExtraDecorKind, SheetCoord> = {
  tallGrass: { x: 256, y: 512 },
  sprout: { x: 512, y: 512 }
};

export function getErbaSheetCoord(asset: ErbaTileAsset1x1): SheetCoord {
  return ERBA[asset];
}

export function getSpiaggiaSheetCoord(asset: SpiaggiaTileAsset1x1): SheetCoord {
  return SPIAGGIA[asset];
}

export function getSpiaggiaSheetCoordForWaterMask(mask: number): SheetCoord {
  return getSpiaggiaSheetCoord(pickBestSpiaggiaAssetForWaterMask(mask));
}

export function getErbaSpiaggiaSheetCoord(asset: ErbaSpiaggiaTileAsset1x1): SheetCoord {
  return ERBA_SPIAGGIA[asset];
}

export function getStradaSheetCoord(asset: StradaTileAsset1x1): SheetCoord {
  return STRADA[asset] ?? pickBestStradaSheetCoordForGrassMask(STRADA_ASSET_GRASS_MASK[asset] ?? 0);
}

export function getErbaDecorSheetCoord(kind: ErbaExtraDecorKind): SheetCoord {
  return DECOR[kind];
}

export function getWaterSheetCoord(frame: number): SheetCoord {
  const f =
    ((frame % OVERWORLD_SHEET_PX.waterFrames) + OVERWORLD_SHEET_PX.waterFrames) %
    OVERWORLD_SHEET_PX.waterFrames;
  return {
    x: OVERWORLD_SHEET_PX.waterAnimX + f * OVERWORLD_SHEET_PX.tile,
    y: OVERWORLD_SHEET_PX.waterAnimY
  };
}
