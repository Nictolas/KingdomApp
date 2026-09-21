import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("avanzaMese non usa più la terminologia Skip Mese", () => {
  const source = readFileSync("src/game/avanzaMese.ts", "utf8");

  assert.doesNotMatch(source, /Skip Mese/i);
  assert.match(source, /cambio mese automatico/i);
});
