import assert from "node:assert/strict";
import test from "node:test";
import {
  calcolaAnchorCostruzione2x2,
  calcolaAnchorEdificioMultiCella,
  calcolaPreviewPiazzamento,
  costruzioneTerrenoPersistente,
  edificioRispettaCriteriPiazzamento,
  footprintTerreno2x2Valido
} from "../src/game/mappaCostruzioneAnteprima";

test("construction terrain mode stays active only for road and terrain selections", () => {
  assert.equal(costruzioneTerrenoPersistente(null), false);
  assert.equal(costruzioneTerrenoPersistente({ tipo: "strada" }), true);
  assert.equal(costruzioneTerrenoPersistente({ tipo: "terreno", kind: "acqua" }), true);
  assert.equal(costruzioneTerrenoPersistente({ tipo: "terreno", kind: "spiaggia" }), true);
  assert.equal(costruzioneTerrenoPersistente({ tipo: "terreno", kind: "erba" }), true);
  assert.equal(
    costruzioneTerrenoPersistente({ tipo: "edificio", edificio: {} as never }),
    false
  );
});

test("construction 2x2 anchor preserves the road-footprint anchor behavior", () => {
  assert.deepEqual(calcolaAnchorCostruzione2x2(12, 5, 5), { anchor: 12, w: 2, h: 2 });
  assert.deepEqual(calcolaAnchorCostruzione2x2(24, 5, 5), { anchor: 18, w: 2, h: 2 });
  assert.deepEqual(calcolaAnchorCostruzione2x2(0, 1, 1), { anchor: null, w: 2, h: 2 });
});

test("terrain 2x2 preview rejects occupied cells", () => {
  assert.equal(
    footprintTerreno2x2Valido(
      "erba",
      12,
      5,
      5,
      {},
      { 12: { id: 1, nome: "Test", emoji: "" } }
    ),
    false
  );
});

test("water 2x2 preview accepts sea, river, sand and grass under the current rules", () => {
  assert.equal(footprintTerreno2x2Valido("acqua", 0, 5, 5, {}, {}), true);
  assert.equal(
    footprintTerreno2x2Valido(
      "acqua",
      12,
      5,
      5,
      { 12: "river", 13: "sabbia", 17: "erba", 18: "erba" },
      {}
    ),
    true
  );
});

test("beach 2x2 preview rejects existing water", () => {
  assert.equal(
    footprintTerreno2x2Valido("spiaggia", 12, 5, 5, { 12: "river" }, {}),
    false
  );
});

test("grass 2x2 preview rejects existing water and accepts dry terrain", () => {
  assert.equal(footprintTerreno2x2Valido("erba", 12, 5, 5, { 12: "river" }, {}), false);
  assert.equal(footprintTerreno2x2Valido("erba", 12, 5, 5, { 12: "sabbia" }, {}), true);
});

test("building placement validation delegates desalination to the coastal rule", () => {
  assert.equal(
    edificioRispettaCriteriPiazzamento(
      "Dissalatore",
      1,
      2,
      2,
      {},
      { 6: "sabbia", 7: "sabbia" },
      5,
      5
    ),
    true
  );
  assert.equal(
    edificioRispettaCriteriPiazzamento(
      "Dissalatore",
      1,
      2,
      2,
      { 6: { id: 1, nome: "Test", emoji: "" } },
      { 6: "sabbia", 7: "sabbia" },
      5,
      5
    ),
    false
  );
});

test("building placement validation rejects rivers and reserved building buffers", () => {
  assert.equal(edificioRispettaCriteriPiazzamento("Bar", 24, 1, 1, {}, {}, 7, 7), true);
  assert.equal(
    edificioRispettaCriteriPiazzamento("Bar", 24, 1, 1, {}, { 24: "river" }, 7, 7),
    false
  );
  assert.equal(
    edificioRispettaCriteriPiazzamento(
      "Bar",
      24,
      1,
      1,
      { 16: { id: 1, nome: "Test", emoji: "" } },
      {},
      7,
      7
    ),
    false
  );
});

test("multicell building anchor preserves configured footprint and a valid preferred anchor", () => {
  assert.deepEqual(calcolaAnchorEdificioMultiCella(24, "Bar", {}, {}, 7, 7), {
    anchor: 24,
    w: 2,
    h: 2
  });
});

test("multicell building anchor falls back to the nearest free anchor and keeps desalination rules", () => {
  assert.deepEqual(calcolaAnchorEdificioMultiCella(0, "Bar", {}, {}, 7, 7), {
    // Posizione valida vicino alla costa: il divieto riguarda solo la generazione iniziale.
    anchor: 8,
    w: 2,
    h: 2
  });
  assert.deepEqual(
    calcolaAnchorEdificioMultiCella(7, "Dissalatore", {}, { 6: "sabbia", 7: "sabbia" }, 5, 5),
    { anchor: 1, w: 2, h: 2 }
  );
});


test("placement preview returns null without a hovered cell", () => {
  assert.equal(calcolaPreviewPiazzamento({ tipo: "strada" }, null, {}, {}, 5, 5), null);
});

test("placement preview preserves road and terrain 2x2 cells and validity", () => {
  assert.deepEqual(calcolaPreviewPiazzamento({ tipo: "strada" }, 24, {}, {}, 7, 7), {
    celle: [24, 25, 31, 32],
    valido: true
  });
  assert.deepEqual(
    calcolaPreviewPiazzamento({ tipo: "terreno", kind: "erba" }, 24, {}, {}, 7, 7),
    {
      celle: [24, 25, 31, 32],
      valido: true
    }
  );
});

test("placement preview preserves building footprint and placement validity", () => {
  assert.deepEqual(
    calcolaPreviewPiazzamento(
      { tipo: "edificio", edificio: { nome: "Bar" } as never },
      24,
      {},
      {},
      7,
      7
    ),
    {
      celle: [24, 25, 31, 32],
      valido: true
    }
  );
});
