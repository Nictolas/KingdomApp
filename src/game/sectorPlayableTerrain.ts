/**
 * Fixed-sector atlas selection. Draw only one 64×64 source tile per map cell;
 * the art originates in MyKingdom's existing spritesheet-full.png.
 * No GameContext, persistence or gameplay dependencies.
 */
import { getErbaSheetCoord, type SheetCoord } from "./overworldSpritesheetLayout";
import { isRoadCell, PREVIEW_COLS, PREVIEW_ROWS } from "./sectorPreviewModel";

const ROAD_BLOCK_X = 512;
const ROAD_BLOCK_Y = 128;
const TILE = 64;

/** Sprites already present in the shared atlas: a corn crop and a wooden crate. */
export const FARM_CROP_COORD: Readonly<SheetCoord> = { x: 256, y: 1280 };
export const SHOP_CRATE_COORD: Readonly<SheetCoord> = { x: 704, y: 512 };

export function sectorBuildingAccent(kind: string): Readonly<SheetCoord> | null {
  if (kind === "farm") return FARM_CROP_COORD;
  if (kind === "shop") return SHOP_CRATE_COORD;
  return null;
}

/**
 * The atlas has a proper 3×3 block of earthy terrain at [512,128] to
 * [704,320]. In particular, the old "verticale" fallback [64,768] belongs
 * to an unrelated metallic prop, not a road. Choose border/corner/centre
 * tiles by the neighbouring grass on each side of the fixed 2-cell-wide
 * crossroads. Out-of-bounds neighbours count as grass.
 */
export function sectorGroundCoord(x: number, y: number): SheetCoord {
  if (!Number.isInteger(x) || !Number.isInteger(y) ||
      x < 0 || x >= PREVIEW_COLS || y < 0 || y >= PREVIEW_ROWS) {
    throw new RangeError("Invalid fixed-sector tile coordinate");
  }
  if (!isRoadCell(x, y)) {
    // Keep grass readable; avoid repeating a large border tuft every 4 cells.
    return getErbaSheetCoord((x * 13 + y * 29) % 11 === 0 ? "campo_nord_est" : "centro");
  }
  const westGrass = x === 0 || !isRoadCell(x - 1, y);
  const eastGrass = x === PREVIEW_COLS - 1 || !isRoadCell(x + 1, y);
  const northGrass = y === 0 || !isRoadCell(x, y - 1);
  const southGrass = y === PREVIEW_ROWS - 1 || !isRoadCell(x, y + 1);
  const col = westGrass ? 0 : eastGrass ? 2 : 1;
  const row = northGrass ? 0 : southGrass ? 2 : 1;
  return { x: ROAD_BLOCK_X + col * TILE, y: ROAD_BLOCK_Y + row * TILE };
}
