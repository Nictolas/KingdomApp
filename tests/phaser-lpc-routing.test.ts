import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

test("Phaser usa LPC solo per personaggi con aspetto LPC valido", () => {
  const source = readFileSync("src/phaser/scenes/KingdomMapScene.ts", "utf8");

  assert.match(source, /const needsLpc = this\.characterNeedsLpc\(character\);/);
  assert.doesNotMatch(source, /const needsLpc = character\.appearance !== "golem";/);
  assert.match(source, /const canSpawnGolem = character\.appearance === "golem";/);
  assert.match(source, /const canSpawnEmoji = !!character\.markerEmoji;/);
  assert.equal(existsSync("assets/pixel-art/characters/human-colonist.png"), false);
});
