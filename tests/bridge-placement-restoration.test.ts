import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isCellaOkPerPonte } from "../src/game/ponteMappa";

test("il Ponte si può piazzare solo su una cella di fiume libera", () => {
  assert.equal(isCellaOkPerPonte(5, { 5: "river" }, {}), true);
  assert.equal(isCellaOkPerPonte(5, {}, {}), false);
  assert.equal(isCellaOkPerPonte(5, { 5: "river" }, { 5: { nome: "Capanna" } }), false);
});

test("il menu Costruisci espone il Ponte come selezione dedicata", () => {
  const mappa = readFileSync("app/mappa.tsx", "utf8");
  const preview = readFileSync("src/game/mappaCostruzioneAnteprima.ts", "utf8");

  assert.match(mappa, /setCostruzioneSelezione\(\{ tipo: "ponte" \}\)/);
  assert.match(mappa, /piazzaPonteSuCella/);
  assert.match(mappa, /row\.nome === NOME_PONTE/);
  assert.match(preview, /tipo: "ponte"/);
  assert.match(preview, /isCellaOkPerPonte/);
});
