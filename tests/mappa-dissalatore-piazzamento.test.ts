import assert from "node:assert/strict";
import test from "node:test";
import {
  cellaÈSabbiaDissalatore,
  footprintDissalatoreMareSabbiaValido,
  trovaAnchorDissalatore
} from "../src/game/mappaDissalatorePiazzamento";

test("desalination sand helper accepts only inland sand", () => {
  assert.equal(cellaÈSabbiaDissalatore(6, { 6: "sabbia" }, 5, 5), true);
  assert.equal(cellaÈSabbiaDissalatore(1, { 1: "sabbia" }, 5, 5), false);
  assert.equal(cellaÈSabbiaDissalatore(6, {}, 5, 5), false);
});

test("desalination footprint requires exactly two sea cells and two sand cells", () => {
  assert.equal(
    footprintDissalatoreMareSabbiaValido(1, 5, 5, { 6: "sabbia", 7: "sabbia" }, {}),
    true
  );
  assert.equal(
    footprintDissalatoreMareSabbiaValido(0, 5, 5, { 6: "sabbia" }, {}),
    false
  );
});

test("desalination footprint rejects river and occupied cells", () => {
  assert.equal(
    footprintDissalatoreMareSabbiaValido(1, 5, 5, { 6: "river", 7: "sabbia" }, {}),
    false
  );
  assert.equal(
    footprintDissalatoreMareSabbiaValido(
      1,
      5,
      5,
      { 6: "sabbia", 7: "sabbia" },
      { 6: { id: 1, nome: "Test", emoji: "" } }
    ),
    false
  );
});

test("desalination anchor search stays constrained to footprints containing the touched cell", () => {
  assert.equal(trovaAnchorDissalatore(7, {}, { 6: "sabbia", 7: "sabbia" }, 5, 5), 1);
  assert.equal(trovaAnchorDissalatore(12, {}, { 6: "sabbia", 7: "sabbia" }, 5, 5), null);
});
