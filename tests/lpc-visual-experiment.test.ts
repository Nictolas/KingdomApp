import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { lpcLookFromSearch } from "../src/character-system/lpcVisualExperiment";

test("classic uses original artwork in addition to original geometry", () => {
  assert.equal(lpcLookFromSearch("?lpcLook=classic"), "classic");
  assert.equal(lpcLookFromSearch("?lpcLook=refined"), "refined");
  assert.equal(lpcLookFromSearch(""), "refined");
  assert.equal(lpcLookFromSearch("?user=1&lpcLook=classic&x=2"), "classic");
  assert.equal(lpcLookFromSearch("?lpcLook=CLASSIC"), "refined");
});

test("the scene and renderer share a single source of truth for A/B", () => {
  const scene = readFileSync(new URL("../src/phaser/scenes/KingdomMapScene.ts", import.meta.url), "utf8");
  const surface = readFileSync(new URL("../src/components/PhaserMapSurface.web.tsx", import.meta.url), "utf8");
  assert.match(scene, /LPC_VISUAL_MODE = lpcLookFromSearch\(/);
  assert.match(surface, /lpcHdEnabled = .*lpcLookFromSearch\(window.location.search\) === "refined"/);
  assert.match(surface, /if \(lpcHdEnabled && role &&/);
});
