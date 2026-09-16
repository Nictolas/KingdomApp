import assert from "node:assert/strict";
import test from "node:test";
import {
  calcolaAnchorCostruzione2x2,
  costruzioneTerrenoPersistente
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
