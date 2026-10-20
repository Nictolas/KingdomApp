import assert from "node:assert/strict";
import test from "node:test";
import { capitalizzaNomePersona } from "../src/game/nomiUmani";

test("nomi e cognomi inseriti nel creatore mantengono spazi e apostrofi", () => {
  assert.equal(capitalizzaNomePersona("  mARIO  "), "Mario");
  assert.equal(capitalizzaNomePersona("d'ANGELO"), "D'Angelo");
  assert.equal(capitalizzaNomePersona("anna-maria"), "Anna-Maria");
  assert.equal(capitalizzaNomePersona("giAn luca"), "Gian Luca");
  assert.equal(capitalizzaNomePersona(""), "");
});
