import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Abitanti mostra il Culto delle Ombre e non il vecchio Culto degli Alieni", () => {
  const source = readFileSync("app/abitanti.tsx", "utf8");

  assert.match(source, /Culto delle Ombre/);
  assert.match(source, /🌑/);
  assert.doesNotMatch(source, /Culto degli Alieni|👽/);
});
