import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Portraits never display an empty circle while LPC layers are loading", () => {
  const frame = readFileSync("src/ui/CircularSpriteFrame.tsx", "utf8");
  const renderer = readFileSync("src/components/SpriteCharacterRenderer.tsx", "utf8");
  assert.match(frame, /layerIds\.every\(id => loadedIds\.has\(id\)\)/);
  assert.match(frame, /!canShow \|\| assetFailed \|\| !allLoaded/);
  assert.match(frame, /!allLoaded && styles\.loading/);
  assert.match(frame, /onAssetLoad=\{\(sourceId\) => setLoadedIds/);
  assert.match(frame, /missingSource = layers\.some/);
  assert.match(renderer, /onLoad=\{\(\) => onAssetLoad\?\.\(layer\.sourceId\)\}/);
  assert.match(renderer, /onError=\{onAssetError\}/);
});
