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
 * Strade: autotile sabbia dallo sheet (i PNG strada_* erano export errati a foglio intero).
 * `generica` usa il campo arato (4 foglie).
 */
const STRADA: Record<StradaTileAsset1x1, SheetCoord> = {
  orizzontale: SPIAGGIA.centro,
  verticale: SPIAGGIA.centro,
  nord: SPIAGGIA.sud,
  sud: SPIAGGIA.nord,
  est: SPIAGGIA.ovest,
  ovest: SPIAGGIA.est,
  curva_nord_est: SPIAGGIA.nord_ovest,
  curva_nord_ovest: SPIAGGIA.nord_est,
  curva_sud_est: SPIAGGIA.sud_ovest,
  curva_sud_ovest: SPIAGGIA.sud_est,
  incrocio_nord_est_ovest: SPIAGGIA.centro,
  incrocio_nord_est_sud: SPIAGGIA.centro,
  incrocio_est_sud_ovest: SPIAGGIA.centro,
  incrocio_est_sud_nord: SPIAGGIA.centro,
  incrocio_centro: SPIAGGIA.centro,
  centro: SPIAGGIA.centro,
  generica: { x: 256, y: 320 }
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
  return STRADA[asset];
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
