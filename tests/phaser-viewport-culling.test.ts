import assert from "node:assert/strict";
import test from "node:test";

import {
  computePhaserWorldViewCellRange,
  isCellInsidePhaserGridRange,
  isPointNearPhaserWorldView,
  phaserGridCellRangesEqual
} from "../src/phaser/adapters/phaserViewportCulling.ts";

test("character viewport culling keeps visible and padded-edge points only", () => {
  const view = { x: 100, y: 200, width: 800, height: 600 };

  assert.equal(isPointNearPhaserWorldView(100, 200, view, 60), true);
  assert.equal(isPointNearPhaserWorldView(50, 180, view, 60), true);
  assert.equal(isPointNearPhaserWorldView(30, 180, view, 60), false);
  assert.equal(isPointNearPhaserWorldView(970, 820, view, 60), false);
});

test("synthetic 50x50 population renders only a viewport subset", () => {
  const cols = 50;
  const rows = 50;
  const cellSize = 40;
  const view = { x: 0, y: 0, width: 800, height: 600 };
  const padding = cellSize * 1.5;
  let visible = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellSize + cellSize / 2;
      const y = row * cellSize + cellSize / 2;
      if (isPointNearPhaserWorldView(x, y, view, padding)) visible++;
    }
  }

  assert.equal(visible, 374);
  assert.equal(cols * rows, 2500);
  assert.ok(visible < (cols * rows) * 0.2);
});

test("water cell becomes eligible for frame sync after camera pan", () => {
  const cellSize = 40;
  const padding = cellSize * 1.5;
  const waterX = 1020;
  const waterY = 300;
  const beforePan = { x: 0, y: 0, width: 800, height: 600 };
  const afterPan = { x: 400, y: 0, width: 800, height: 600 };

  assert.equal(isPointNearPhaserWorldView(waterX, waterY, beforePan, padding), false);
  assert.equal(isPointNearPhaserWorldView(waterX, waterY, afterPan, padding), true);
});

test("static tile culling keeps only a buffered subset of a 50x50 map", () => {
  const cols = 50;
  const rows = 50;
  const range = computePhaserWorldViewCellRange(
    { x: 0, y: 0, width: 800, height: 600 },
    cols,
    rows,
    40,
    2
  );

  let visibleCells = 0;
  for (let cell = 0; cell < cols * rows; cell++) {
    if (isCellInsidePhaserGridRange(cell, cols, range)) visibleCells++;
  }

  assert.deepEqual(range, { colStart: 0, colEnd: 22, rowStart: 0, rowEnd: 17 });
  assert.equal(visibleCells, 414);
  assert.ok(visibleCells < (cols * rows) * 0.2);
});

test("static tile range does not change for sub-cell camera movement", () => {
  const first = computePhaserWorldViewCellRange(
    { x: 400, y: 400, width: 800, height: 600 },
    50,
    50,
    40,
    2
  );
  const sameCell = computePhaserWorldViewCellRange(
    { x: 405, y: 405, width: 800, height: 600 },
    50,
    50,
    40,
    2
  );
  const crossedCell = computePhaserWorldViewCellRange(
    { x: 440, y: 400, width: 800, height: 600 },
    50,
    50,
    40,
    2
  );

  assert.equal(phaserGridCellRangesEqual(first, sameCell), true);
  assert.equal(phaserGridCellRangesEqual(first, crossedCell), false);
});
