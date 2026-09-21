import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("aprendo Costruisci dal tutorial viene evidenziata la voce Ponte", () => {
  const mappa = readFileSync("app/mappa.tsx", "utf8");

  assert.match(mappa, /pendingPonteSpotlightRef/);
  assert.match(mappa, /MAPPA_PONTE/);
  assert.match(mappa, /showSpotlight\(\{/);
  assert.match(mappa, /ref=\{ponteSpotlightRef\}/);
  assert.match(mappa, /onPress=\{scegliPonte\}/);
  assert.match(mappa, /setCostruzioneSelezione\(\{ tipo: "ponte" \}\)/);
});
