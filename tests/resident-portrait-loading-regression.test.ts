import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("LPC portraits remain visible across equivalent game-tick rerenders", () => {
  const frame = readFileSync("src/ui/CircularSpriteFrame.tsx", "utf8");
  const renderer = readFileSync("src/components/SpriteCharacterRenderer.tsx", "utf8");
  const preview = readFileSync("src/ui/AbitanteAvatarPreview.tsx", "utf8");
  assert.match(frame, /const layerSignature = layerIds\.join\("\|"\)/);
  assert.match(frame, /essentialIds\.every\(id => loadedIds\.has\(id\)\)/);
  assert.match(frame, /essentialIds\.every\(id => Boolean\(LPC_ASSET_SOURCES\[id\]\)\)/);
  assert.match(frame, /setFailedSource\(null\)/);
  assert.doesNotMatch(frame, /setLoadedIds\(new Set\(\)\)/);
  assert.doesNotMatch(frame, /styles\.loading/);
  assert.match(frame, /onAssetLoad=\{\(sourceId\) => setLoadedIds/);
  assert.match(frame, /onAssetError=\{\(sourceId\) => setFailedSource\(sourceId\)\}/);
  assert.match(renderer, /onLoad=\{\(\) => onAssetLoad\?\.\(layer\.sourceId\)\}/);
  assert.match(renderer, /onError=\{\(\) => onAssetError\?\.\(layer\.sourceId\)\}/);
  assert.match(preview, /const aspetto = React\.useMemo/);
  assert.match(frame, /!canShow \|\| essentialFailed \|\| !essentialLoaded/);
});
