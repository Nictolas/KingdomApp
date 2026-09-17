import assert from "node:assert/strict";
import test from "node:test";
import {
  calcolaAnchorCostruzione2x2,
  costruzioneTerrenoPersistente,
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
