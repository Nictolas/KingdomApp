import {
  getErbaDecorSheetCoord,
  getErbaSheetCoord,
  getErbaSpiaggiaSheetCoord,
  getSpiaggiaSheetCoordForWaterMask,
  getStradaSheetCoord,
  getWaterSheetCoord
} from "../../game/overworldSpritesheetLayout";
import { isTerrenoAcqua } from "../../game/riverGeneration";
import {
  buildCoastalAssetLookups,
  buildErbaAssetLookup,
  buildStradaAssetLookup,
  erbaExtraDecorCasuale,
  sandWaterEdgeMaskAt
} from "../../game/terrainSpriteHelpers";
import type { MappaRuntimeState } from "../../game/mappaTypes";
import type { PhaserMapSnapshot, PhaserMapTile } from "./mapSceneBridge";

export function buildPhaserMapSnapshot(
  state: MappaRuntimeState,
  cols: number,
  rows: number,
  cellSize: number,
  revision: number
): PhaserMapSnapshot {
  const stradaAssetAt = buildStradaAssetLookup(cols, rows, state.terrenoInMappa, state.edificiInMappa);
  const erbaAssetAt = buildErbaAssetLookup(
    cols,
    rows,
    state.terrenoInMappa,
    state.edificiInMappa,
    stradaAssetAt
  );
  const { erbaSpiaggiaAssetAt } = buildCoastalAssetLookups(
    cols,
    rows,
    state.terrenoInMappa,
    state.edificiInMappa
  );

  const tiles: PhaserMapTile[] = [];
  for (let index = 0; index < cols * rows; index++) {
    const terreno = state.terrenoInMappa[index] ?? "erba";
    const edificio = state.edificiInMappa[index];
    const strada = edificio?.nome === "Strada";

    if (isTerrenoAcqua(index, state.terrenoInMappa, cols, rows)) {
      const coord = getWaterSheetCoord(0);
      tiles.push({ index, frameX: coord.x, frameY: coord.y, animation: "water" });
      continue;
    }

    if (terreno === "sabbia") {
      const coord = getSpiaggiaSheetCoordForWaterMask(
        sandWaterEdgeMaskAt(index, cols, rows, state.terrenoInMappa)
      );
      tiles.push({ index, frameX: coord.x, frameY: coord.y });
      continue;
    }

    if (strada) {
      const coord = getStradaSheetCoord(stradaAssetAt(index));
      tiles.push({ index, frameX: coord.x, frameY: coord.y });
      continue;
    }

    const coastal = erbaSpiaggiaAssetAt(index);
    const coord = coastal
      ? getErbaSpiaggiaSheetCoord(coastal)
      : getErbaSheetCoord(erbaAssetAt(index) ?? "centro");
    const decor = !edificio && !coastal ? erbaExtraDecorCasuale(index, cols) : null;
    const decorCoord = decor ? getErbaDecorSheetCoord(decor) : null;
    tiles.push({
      index,
      frameX: coord.x,
      frameY: coord.y,
      overlayFrameX: decorCoord?.x,
      overlayFrameY: decorCoord?.y
    });
  }

  return { cols, rows, cellSize, tiles, revision };
}
