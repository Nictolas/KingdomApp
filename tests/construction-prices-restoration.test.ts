import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { costoCostruzioneMonete, edificioSiPagaInMonete } from "../src/game/edificiPrezzi";
import { costoMaterialeEdilePerFootprint } from "../src/game/costruzioneEdifici";

test("ripristina i prezzi in monete del catalogo", () => {
  assert.equal(costoCostruzioneMonete("Ponte"), 100);
  assert.equal(costoCostruzioneMonete("Capanna"), 50);
  assert.equal(costoCostruzioneMonete("Serra"), 100);
  assert.equal(costoCostruzioneMonete("Emporio"), 100);
  assert.equal(costoCostruzioneMonete("Cripta Necromantica"), 2000);
});

test("gli edifici a monete non consumano anche Materiale Edile", () => {
  assert.equal(edificioSiPagaInMonete("Emporio"), true);
  assert.equal(costoMaterialeEdilePerFootprint("Emporio", 2, 2), 0);
  assert.ok(costoMaterialeEdilePerFootprint("Ufficio Edile", 2, 2) > 0);
});

test("la mappa mostra e addebita i prezzi di costruzione", () => {
  const mappa = readFileSync("app/mappa.tsx", "utf8");
  assert.match(mappa, /costoCostruzioneMonete/);
  assert.match(mappa, /modalOptionCostruisciPrezzo/);
  assert.match(mappa, /costoMonete/);
  assert.match(mappa, /Monete insufficienti/);
});
