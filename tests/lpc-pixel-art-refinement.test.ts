import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { refineLpcPixels, LPC_HD_FRAME_PX } from "../src/character-system/lpcPixelArtRefinement";

test("2x dettaglio LPC: frame, alpha e colore degli sprite rimangono allineati", () => {
  const width = 128, height = 256; // 2 frame idle, 4 direzioni
  const pixels = new Uint8ClampedArray(width * height * 4);
  const fill = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    pixels.set([160, 110, 80, 255], i);
  };
  for (let y = 10; y < 48; y++) {
    for (let x = 12; x < 42; x++) fill(x, y); // first frame only
  }

  const rendered = refineLpcPixels(pixels, width, height, "raceFeatures");
  assert.equal(LPC_HD_FRAME_PX, 128);
  assert.equal(rendered.width, 256);
  assert.equal(rendered.height, 512);
  const at = (x: number, y: number) => rendered.pixels.slice((y * rendered.width + x) * 4, (y * rendered.width + x) * 4 + 4);
  assert.deepEqual([...at(0, 0)], [0, 0, 0, 0]);
  assert.deepEqual([...at(24, 20)], [160, 110, 80, 255]);
  assert.equal(at(255, 0)[3], 0);
  assert.equal(at(48, 60)[3], 255);
  assert.equal(at(160, 40)[3], 0); // neighbouring animation frame untouched
  assert.ok(rendered.pixels.some((value, i) => (i % 4 === 0) && value > 160 && rendered.pixels[i + 3] === 255));
});

test("il dettaglio non inventa bordi opachi e valida il formato LPC", () => {
  assert.throws(() => refineLpcPixels(new Uint8ClampedArray(16), 2, 2, "body"));
  const pixels = new Uint8ClampedArray(64 * 256 * 4);
  pixels[3] = 255;
  const rendered = refineLpcPixels(pixels, 64, 256, "body");
  assert.equal(rendered.pixels[3], 255);
  assert.equal(rendered.pixels[7], 255);
  assert.equal(rendered.pixels[11], 0);
});

test("il renderer carica frame di dimensioni differenti e torna agli asset originali", () => {
  const scene = readFileSync(new URL("../src/phaser/scenes/KingdomMapScene.ts", import.meta.url), "utf8");
  const surface = readFileSync(new URL("../src/components/PhaserMapSurface.web.tsx", import.meta.url), "utf8");
  assert.match(scene, /getLpcLayerFrameSize\?\.\(id\) \?\? 64/);
  assert.match(scene, /frameWidth: pixelSize, frameHeight: pixelSize/);
  assert.match(surface, /lpcHighDetailPendingIds/);
  assert.match(surface, /refineLpcSpriteUrl\(asset\.uri, role\)/);
  assert.match(surface, /lpcLayerUriCache\.set\(sourceId, asset\.uri\)/);
});
