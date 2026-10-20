import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { characterStepDurationMs, lpcFrameForRow } from "../src/phaser/adapters/characterWalkMotion";

test("velocita' costante per passo: scala storica 40px e nuova scala 64px", () => {
  assert.equal(characterStepDurationMs(0, 0, 40, 0), 500);
  assert.equal(characterStepDurationMs(0, 0, 64, 0), 800);
  assert.equal(characterStepDurationMs(100, 50, 100, -14), 800);
  assert.equal(characterStepDurationMs(0, 0, 0, 0), 120);
});

test("fotogrammi LPC corretti per idle a due colonne e walk a nove", () => {
  assert.equal(lpcFrameForRow(0, 9), 0);
  assert.equal(lpcFrameForRow(1, 9), 9);
  assert.equal(lpcFrameForRow(2, 9), 18);
  assert.equal(lpcFrameForRow(3, 9), 27);
  assert.equal(lpcFrameForRow(2, 2), 4);
});

test("Phaser evita reset al frame up e usa tempi di camminata coerenti", () => {
  const scene = readFileSync(new URL("../src/phaser/scenes/KingdomMapScene.ts", import.meta.url), "utf8");
  assert.doesNotMatch(scene, /duration:\s*320\b/);
  assert.equal((scene.match(/characterStepDurationMs\(/g) ?? []).length, 3);
  assert.equal((scene.match(/this\.playLpcLayerWalk\(/g) ?? []).length, 3);
  assert.doesNotMatch(scene, /setTexture\(layer\.sourceId\);\s*this\.playLpcLayerWalk/);
  assert.match(scene, /if \(sprite\.texture\.key !== sourceId\) \{[\s\S]*?sprite\.setTexture\(sourceId, firstFrame\)/);
  assert.match(scene, /lpcFrameForRow\(LPC_DIRECTION_ROWS\[directionName\], layer\.sheet\.columns\)/);
});
