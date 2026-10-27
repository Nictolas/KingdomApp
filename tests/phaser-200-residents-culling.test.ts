import assert from "node:assert/strict";
import test from "node:test";

import { isPointNearPhaserWorldView } from "../src/phaser/adapters/phaserViewportCulling.ts";

// Scenario sintetico: 200 abitanti distribuiti in modo deterministico.
// Verifica il culling, NON misura FPS, IA, pathfinding o consumo di memoria mobile.
const characters = Array.from({ length: 200 }, (_, id) => ({
  id,
  x: (id % 10) * 200 + 20,
  y: Math.floor(id / 10) * 100 + 20
}));

const padding = 60;
const viewport = { x: 0, y: 0, width: 800, height: 600 };

function visibleIds(view: typeof viewport): number[] {
  return characters
    .filter(({ x, y }) => isPointNearPhaserWorldView(x, y, view, padding))
    .map(({ id }) => id);
}

test("200 simulated residents: viewport culling only selects characters near the camera", () => {
  const visible = visibleIds(viewport);

  assert.equal(characters.length, 200);
  assert.equal(new Set(characters.map(({ id }) => id)).size, 200);
  assert.equal(visible.length, 35);
  assert.ok(visible.every((id) => id >= 0 && id < 200));
  assert.ok(visible.length < characters.length);
});

test("camera pan updates the visible subset without removing offscreen residents", () => {
  const before = new Set(visibleIds(viewport));
  const after = new Set(visibleIds({ x: 900, y: 800, width: 800, height: 600 }));

  assert.equal(before.size, 35);
  assert.equal(after.size, 28);
  assert.equal([...before].filter((id) => after.has(id)).length, 0);
  assert.equal(characters.length, 200, "culling must not delete simulated residents");
});

test("zero/fully out-of-view residents do not appear as visible sprites", () => {
  assert.equal(visibleIds({ x: 3000, y: 3000, width: 800, height: 600 }).length, 0);
  assert.equal(
    visibleIds({ x: -100, y: -100, width: 2200, height: 2300 }).length,
    200
  );
});
