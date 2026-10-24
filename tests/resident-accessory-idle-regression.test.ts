import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeCharacterAppearance } from "../src/character-system/appearance.ts";
import { resolveCharacterLayers } from "../src/character-system/registry.ts";
import { creaCharacterAppearance } from "../src/game/personaggioAspetto.ts";

test("Il ritratto fermo con annaffiatoio usa l'animazione del corpo, non quella dell'accessorio", () => {
  const a = normalizeCharacterAppearance({
    ...creaCharacterAppearance("Umano"),
    accessory: "watering_can",
    upperOutfit: "none", lowerOutfit: "none", fullOutfit: "none"
  });
  const layers = resolveCharacterLayers(a, "idle");
  assert.ok(layers.length >= 4);
  assert.equal(layers[0]?.layer, "accessory", "Un accessorio in primo piano o dietro il corpo riproduce il bug");
  assert.equal(layers[0]?.sheet.animations.idle, undefined, "L'accessorio usa solo lo sheet walk");
  const body = layers.find(layer => layer.layer === "body");
  assert.ok(body?.sheet.animations.idle, "Il corpo fornisce i frame idle");
  const renderer = readFileSync("src/components/SpriteCharacterRenderer.tsx", "utf8");
  assert.match(renderer, /const baseLayer = layers\.find\(layer => layer\.layer === "body"\)/);
  assert.match(renderer, /const definition = baseLayer\?\.sheet\.animations\[animation\]/);
  assert.match(renderer, /const frameWidth = baseLayer!\.sheet\.frameWidth/);
  assert.doesNotMatch(renderer, /const definition = layers\[0\]\?\.sheet\.animations\[animation\]/);
});

test("Un caricamento ritardato di uno sprite non smonta il renderer del ritratto", () => {
  const frame = readFileSync("src/ui/CircularSpriteFrame.tsx", "utf8");
  assert.match(frame, /essentialIds\.includes\(failedSource\) && !loadedIds\.has\(failedSource\)/);
  assert.match(frame, /\{canShow && \(/);
  assert.doesNotMatch(frame, /\{canShow && !essentialFailed && \(/);
});
