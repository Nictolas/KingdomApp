import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("avanzaMese usa terminologia Regno/Golem anche nei commenti runtime", () => {
  const source = readFileSync("src/game/avanzaMese.ts", "utf8");

  assert.doesNotMatch(source, /colonia|\brobot\b/i);
  assert.match(source, /Tesoro del regno/);
  assert.match(source, /Golem, casta diversa/);
});
