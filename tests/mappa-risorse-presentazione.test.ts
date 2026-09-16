import assert from "node:assert/strict";
import test from "node:test";
import { getResourceEmoji, getResourceRoute } from "../src/game/mappaRisorsePresentazione";

test("getResourceEmoji preserves every map resource mapping", () => {
  assert.equal(getResourceEmoji({ nome: "Cibo" }), "🍱");
  assert.equal(getResourceEmoji({ nome: "Energia" }), "⚡");
  assert.equal(getResourceEmoji({ nome: "Acqua potabile" }), "💧");
  assert.equal(getResourceEmoji({ nome: "Materiale Edile" }), "🧱");
  assert.equal(getResourceEmoji({ nome: "Medicine" }), "💊");
  assert.equal(getResourceEmoji({ nome: "Combustibile" }), "⛽");
  assert.equal(getResourceEmoji({ nome: "Rifiuti" }), "🗑️");
  assert.equal(getResourceEmoji({ nome: "Minerali" }), "⛏️");
});

test("getResourceRoute preserves navigable resources and fallback", () => {
  assert.equal(getResourceRoute({ nome: "Cibo" }), "/cibo");
  assert.equal(getResourceRoute({ nome: "Energia" }), "/energia");
  assert.equal(getResourceRoute({ nome: "Acqua potabile" }), "/acqua");
  assert.equal(getResourceRoute({ nome: "Rifiuti" }), "/rifiuti");
  assert.equal(getResourceRoute({ nome: "Materiale Edile" }), null);
});

test("resource presentation matching remains case-insensitive and substring-based", () => {
  assert.equal(getResourceEmoji({ nome: "Scorte di CIBO" }), "🍱");
  assert.equal(getResourceRoute({ nome: "Produzione ENERGIA" }), "/energia");
});
