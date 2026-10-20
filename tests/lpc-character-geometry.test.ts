import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getLpcVisualGeometry } from "../src/phaser/adapters/lpcCharacterGeometry";

test("LPC adult keeps uniform layer geometry in idle and walking", () => {
  const adult = getLpcVisualGeometry(64, "male");
  assert.ok(adult.height > adult.width);
  assert.ok(adult.height / adult.width <= 1.11);
  assert.equal(adult.width, 64 * 1.18);
  assert.equal(adult.offsetY + adult.height / 2, -64 * 0.2 + adult.width / 2);
  assert.deepEqual(getLpcVisualGeometry(64, "female"), adult);
});

test("child and world cell size are handled without modifying logical grid", () => {
  const child = getLpcVisualGeometry(40, "child");
  const adult = getLpcVisualGeometry(40, "male");
  assert.ok(child.height < adult.height);
  assert.equal(child.width, adult.width);
  assert.equal(getLpcVisualGeometry(64, "teen").height, getLpcVisualGeometry(64, "male").height);
  assert.throws(() => getLpcVisualGeometry(0, "male"));
});

test("A/B preset classic restores the original square sprite proportions", () => {
  const original = getLpcVisualGeometry(64, "male", "classic");
  const refined = getLpcVisualGeometry(64, "male", "refined");
  assert.equal(original.width, original.height);
  assert.equal(original.offsetY, -64 * 0.2);
  assert.ok(refined.height > original.height);
  assert.equal(refined.offsetY + refined.height / 2, original.offsetY + original.height / 2);
});

test("all LPC layers resize after setTexture switches between 64px and HD 128px", () => {
  const scene = readFileSync(new URL("../src/phaser/scenes/KingdomMapScene.ts", import.meta.url), "utf8");
  assert.match(scene, /setTexture\(sourceId, firstFrame\)\.setDisplaySize\(size\.width, size\.height\)/);
  assert.match(scene, /setTexture\(layer\.sourceId\)\.setFrame\(lpcFrameForRow\(LPC_DIRECTION_ROWS\[directionName\], layer\.sheet\.columns\)\)\.setDisplaySize\(size\.width, size\.height\)/);
  assert.equal((scene.match(/this\.playLpcLayerWalk\(/g) ?? []).length, 3);
  assert.match(scene, /layerSprite\.anims\.stop\(\);\s*layerSprite\.setTexture\(layer\.sourceId\)/);
  assert.equal((scene.match(/getLpcVisualGeometry\(/g) ?? []).length >= 3, true);
});
