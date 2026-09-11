import assert from "node:assert/strict";
import test from "node:test";

import { capitalizzaNomePersona } from "../src/game/nomiUmani.ts";

test("capitalizza prima lettera di nome e cognome", () => {
  assert.equal(capitalizzaNomePersona("mario"), "Mario");
  assert.equal(capitalizzaNomePersona("rossi"), "Rossi");
  assert.equal(capitalizzaNomePersona("  anna  "), "Anna");
  assert.equal(capitalizzaNomePersona("maria rosa"), "Maria Rosa");
  assert.equal(capitalizzaNomePersona("Mario"), "Mario");
});
