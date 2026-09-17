import assert from "node:assert/strict";
import test from "node:test";

import { isPointNearPhaserWorldView } from "../src/phaser/adapters/phaserViewportCulling.ts";

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
