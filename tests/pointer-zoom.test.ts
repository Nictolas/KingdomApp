import assert from "node:assert/strict";
import test from "node:test";

import { scrollKeepingPointerAnchor } from "../src/game/pointerZoom.ts";

test("lo zoom mantiene fermo il punto mondo sotto il puntatore", () => {
  const world = { x: 900, y: 500 };
  const pointer = { x: 700, y: 180 };
  const viewport = { width: 1000, height: 600 };
  const zoom = 2;
  const scroll = scrollKeepingPointerAnchor(world, pointer, viewport, zoom);
  const reconstructed = {
    x: scroll.x + viewport.width / 2 + (pointer.x - viewport.width / 2) / zoom,
    y: scroll.y + viewport.height / 2 + (pointer.y - viewport.height / 2) / zoom
  };
  assert.deepEqual(reconstructed, world);
});

test("il puntatore al centro conserva lo stesso centro mondo", () => {
  assert.deepEqual(
    scrollKeepingPointerAnchor({ x: 600, y: 400 }, { x: 500, y: 300 }, { width: 1000, height: 600 }, 1.8),
    { x: 100, y: 100 }
  );
});
