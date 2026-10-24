import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

import { dwarfChildOutfit } from "../src/character-system/appearance.ts";
import { LPC_RUNTIME_MANIFEST, resolveCharacterLayers } from "../src/character-system/registry.ts";
import { aspettoPerVisualizzazioneAbitante, generaAspettoDaSeed } from "../src/game/personaggioAspetto.ts";

test("LPC child shirts, pants and skirts are backed by existing idle/walk PNGs", () => {
  const assets = LPC_RUNTIME_MANIFEST.assets;
  for (const [sex, bottom] of [["M", "child_pants"], ["F", "child_skirt"]] as const) {
    const outfit = dwarfChildOutfit(sex, 11);
    assert.equal(outfit.upperOutfit, "child_shirt");
    assert.equal(outfit.lowerOutfit, bottom);
    for (const [layer, style] of [["outfit", "child_shirt"], ["lowerBody", bottom]] as const) {
      for (const animation of ["idle", "walk"] as const) {
        const variants = assets.filter(a => a.bodyType === "child" && a.animation === animation && a.slot === layer && a.semanticId === style);
        assert.ok(variants.length >= 9, style + " " + animation);
        for (const variant of variants) {
          assert.ok(existsSync("assets/character-packs/lpc/generated/" + variant.sourceKey + ".png"), variant.sourceKey);
        }
      }
    }
  }
});

test("150 generated female/male dwarves are fully clothed and visible in idle/walk", () => {
  for (const sesso of ["M", "F"] as const) {
    for (let seed = 1; seed <= 150; seed++) {
      const appearance = generaAspettoDaSeed("Nano", seed, { sesso });
      const persisted = JSON.stringify(appearance);
      const rendered = aspettoPerVisualizzazioneAbitante({
        id: seed + 1, eta: 45, razza: "Nano", sesso, lavoro: "Disoccupato", aspetto: appearance
      })?.characterAppearance;
      assert.ok(rendered);
      assert.equal(rendered.bodyType, "child");
      for (const animation of ["idle", "walk"] as const) {
        const layers = resolveCharacterLayers(rendered, animation);
        assert.ok(layers.some(x => x.layer === "body"), "body " + sesso + " " + seed + " " + animation);
        assert.ok(layers.some(x => x.layer === "raceFeatures"), "head " + sesso + " " + seed + " " + animation);
        assert.ok(layers.some(x => x.layer === "outfit" && x.semanticId === "child_shirt"), "shirt " + sesso + " " + seed + " " + animation);
        assert.ok(layers.some(x => x.layer === "lowerBody" && x.semanticId === (sesso === "F" ? "child_skirt" : "child_pants")), "bottom " + sesso + " " + seed + " " + animation);
      }
      assert.equal(JSON.stringify(appearance), persisted, "visibility must not mutate saved resident");
    }
  }
});

test("all six race previews are composited and every race portrait has a fallback", () => {
  const frame = readFileSync("src/ui/RacePortrait.tsx", "utf8");
  assert.match(frame, /\(!loaded \|\| failed\)/);
  assert.match(frame, /onError/);
  for (const race of ["umano", "elfo", "nano", "orco", "goblin", "felix"]) {
    assert.equal(existsSync("assets/character-packs/lpc/race-portraits/" + race + ".png"), true, race);
  }
});
