import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MAX_PIXEL_ART_RENDER_PIXELS,
  pixelArtCanvasResolution
} from "../src/phaser/adapters/pixelArtCanvasResolution";

test("retina 3x su iPhone senza superare il budget WebGL", () => {
  assert.equal(pixelArtCanvasResolution(3, 390, 844), 3);
  assert.equal(pixelArtCanvasResolution(3, 430, 932), 3);
  assert.equal(pixelArtCanvasResolution(2, 390, 844), 2);
  assert.equal(pixelArtCanvasResolution(1, 390, 844), 1);
});

test("non eccede i pixel del renderer su schermi molto grandi", () => {
  assert.equal(pixelArtCanvasResolution(3, 1920, 1080), 1);
  assert.equal(pixelArtCanvasResolution(3, 1280, 720), 2);
  assert.equal(pixelArtCanvasResolution(0, 390, 844), 1);
  assert.equal(pixelArtCanvasResolution(Number.NaN, 390, 844), 1);
  assert.equal(pixelArtCanvasResolution(3, 0, 0), 3);
  assert.ok(390 * 844 * pixelArtCanvasResolution(3, 390, 844) ** 2 <= MAX_PIXEL_ART_RENDER_PIXELS);
});

test("il renderer usa pixel art e risoluzione fisica coerente", () => {
  const source = readFileSync(new URL("../src/components/PhaserMapSurface.web.tsx", import.meta.url), "utf8");
  assert.match(source, /pixelArt:\s*true/);
  assert.match(source, /resolution:\s*pixelArtCanvasResolution\(/);
  assert.match(source, /imageRendering:\s*"pixelated"/);
});
