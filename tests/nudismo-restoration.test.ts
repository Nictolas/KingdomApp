import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolveStatoLegge } from "../src/game/statoLeggi";

const flags = {
  penaDiMorteAttiva: false,
  leggeRazzialeAttiva: false,
  divietoEspatrioAttivo: false,
  iusPrimaeNoctisAttivo: false,
  coprifuocoAttivo: false,
  tassaPatrimonioPercentuale: 0,
  ivaPercentuale: 0
};

test("Nudismo riflette il toggle reale nello stato Leggi", () => {
  assert.equal(resolveStatoLegge("Nudismo", { ...flags, nudismoAttivo: false }), "Proposta");
  assert.equal(resolveStatoLegge("Nudismo", { ...flags, nudismoAttivo: true }), "In vigore");
});

test("Nudismo è collegato a pagina, stato, salvataggio e rendering mappa", () => {
  const leggi = readFileSync("app/leggi.tsx", "utf8");
  const page = readFileSync("app/nudismo.tsx", "utf8");
  const state = readFileSync("src/hooks/useGameState.ts", "utf8");
  const saveTypes = readFileSync("src/persistence/saveTypes.ts", "utf8");
  const mapping = readFileSync("src/persistence/gameStateMapping.ts", "utf8");
  const mappa = readFileSync("app/mappa.tsx", "utf8");
  const catalogo = readFileSync("src/data/leggiData.ts", "utf8");

  assert.match(leggi, /Nudismo/);
  assert.match(leggi, /\/nudismo/);
  assert.match(page, /setNudismoAttivo/);
  assert.match(state, /nudismoAttivo/);
  assert.match(saveTypes, /nudismoAttivo\?: boolean/);
  assert.match(mapping, /nudismoAttivo: normalized\.policies\.nudismoAttivo \?\? false/);
  assert.match(mappa, /aspettoPerVisualizzazioneAbitante\(abitante, \{ nudismoAttivo \}\)/);
  assert.match(catalogo, /titolo: "Nudismo"/);
});
