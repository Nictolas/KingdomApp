import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolveStatoLegge } from "../src/game/statoLeggi";

const flags = {
  penaDiMorteAttiva: false,
  leggeRazzialeAttiva: true,
  divietoEspatrioAttivo: false,
  iusPrimaeNoctisAttivo: true,
  coprifuocoAttivo: false,
  tassaPatrimonioPercentuale: 0,
  ivaPercentuale: 7
};

test("toggle leggi produce stato UI reale", () => {
  assert.equal(resolveStatoLegge("Pena di Morte", flags), "Proposta");
  assert.equal(resolveStatoLegge("Legge Razziale", flags), "In vigore");
  assert.equal(resolveStatoLegge("Divieto di espatrio", flags), "Proposta");
  assert.equal(resolveStatoLegge("Ius primae noctis", flags), "In vigore");
  assert.equal(resolveStatoLegge("Coprifuoco", flags), "Proposta");
});

test("aliquote fiscali determinano lo stato delle tasse", () => {
  assert.equal(resolveStatoLegge("Tassa sul Patrimonio", flags), "Proposta");
  assert.equal(resolveStatoLegge("Imposta sul Valore Aggiunto", flags), "In vigore");
});

test("leggi senza effetto restano Proposta", () => {
  assert.equal(resolveStatoLegge("Carta dei Diritti dei Sudditi", flags), "Proposta");
  assert.equal(resolveStatoLegge("Regolamento sull'Uso dell'Energia", flags), "Proposta");
});

test("schermata Leggi usa stato dinamico e terminologia Regno", () => {
  const page = readFileSync("app/leggi.tsx", "utf8");
  const data = readFileSync("src/data/leggiData.ts", "utf8");

  assert.match(page, /resolveStatoLegge/);
  assert.match(page, /statoEffettivo/);
  assert.doesNotMatch(page, /legge\.stato/);
  assert.doesNotMatch(page, /colonia|coloni/i);
  assert.doesNotMatch(data, /colonia|coloni/i);
  assert.match(data, /Carta dei Diritti dei Sudditi/);
});
