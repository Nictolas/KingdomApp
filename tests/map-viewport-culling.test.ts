import assert from "node:assert/strict";
import test from "node:test";

import {
  MAP_VIEWPORT_MARGIN_CELLS,
  computeVisibleCellRange
} from "../src/game/mapViewportCulling.ts";

test("il buffer di culling copre un trascinamento rapido prima del render successivo", () => {
  const cellPx = 40;
  const range = computeVisibleCellRange(
    800,
    600,
    { positionX: -800, positionY: -800, scale: 1 },
    50,
    50,
    cellPx
  );

  const bufferPx = MAP_VIEWPORT_MARGIN_CELLS * cellPx;
  assert.ok(bufferPx >= 600, "il prerender deve coprire almeno 600 px di pan rapido");
  assert.equal(range.colStart, 20 - MAP_VIEWPORT_MARGIN_CELLS);
  assert.equal(range.rowStart, 20 - MAP_VIEWPORT_MARGIN_CELLS);
  assert.equal(range.colEnd, 40 + MAP_VIEWPORT_MARGIN_CELLS > 50 ? 50 : 40 + MAP_VIEWPORT_MARGIN_CELLS);
  assert.equal(range.rowEnd, 35 + MAP_VIEWPORT_MARGIN_CELLS > 50 ? 50 : 35 + MAP_VIEWPORT_MARGIN_CELLS);
});

test("il buffer resta limitato ai bordi della mappa", () => {
  assert.deepEqual(
    computeVisibleCellRange(
      800,
      600,
      { positionX: 0, positionY: 0, scale: 1 },
      50,
      50,
      40
    ),
    { colStart: 0, colEnd: 36, rowStart: 0, rowEnd: 31 }
  );
});
