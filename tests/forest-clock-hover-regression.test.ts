import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { calcolaProgressoOrologio } from "../src/game/orologioGiocoSession";

test("clock: i poll piu' rapidi di un secondo conservano i millisecondi", () => {
  const a = calcolaProgressoOrologio(1000, 1900);
  assert.deepEqual(a, { secondi: 0, nextReferenceMs: 1000 });
  const b = calcolaProgressoOrologio(a.nextReferenceMs, 2090);
  assert.deepEqual(b, { secondi: 1, nextReferenceMs: 2000 });
  const c = calcolaProgressoOrologio(b.nextReferenceMs, 2910);
  assert.deepEqual(c, { secondi: 0, nextReferenceMs: 2000 });
  assert.deepEqual(calcolaProgressoOrologio(c.nextReferenceMs, 3060), {secondi: 1, nextReferenceMs: 3000});
});

test("clock: il catch-up lungo resta limitato", () => {
  assert.deepEqual(calcolaProgressoOrologio(1000, 11000), { secondi: 5, nextReferenceMs: 11000 });
  assert.deepEqual(calcolaProgressoOrologio(1000, 7000), { secondi: 5, nextReferenceMs: 7000 });
});

test("hover normale non genera un rettangolo di anteprima", () => {
  const map = readFileSync(new URL("../app/mappa.tsx", import.meta.url), "utf8");
  const scene = readFileSync(new URL("../src/phaser/scenes/KingdomMapScene.ts", import.meta.url), "utf8");
  assert.match(map, /mode: "select",\s*hoverCell: null,\s*affectedCells: \[\],\s*valid: false/);
  assert.match(scene, /interaction\.mode === "select"/);
});

test("la foresta disegna un nastro orizzontale sull'intera larghezza mappa", () => {
  const scene = readFileSync(new URL("../src/phaser/scenes/KingdomMapScene.ts", import.meta.url), "utf8");
  assert.match(scene, /renderBoscoBuilding\(base, overlay, snapshot\.cols \* snapshot\.cellSize/);
  assert.match(scene, /northernRow = 0/);
  assert.match(scene, /for \(let row = 0; row < 6; row\+\+\)/);
  assert.match(scene, /const step = cellSize \* 0\.64/);
  assert.match(scene, /northern-forest-tree-0/);
});
