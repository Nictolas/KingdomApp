import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Generazione Partita usa Regno e non Colonia", () => {
  const source = readFileSync("app/generazione-partita.tsx", "utf8");

  assert.match(source, /regno iniziale è generato/i);
  assert.doesNotMatch(source, /colonia iniziale/i);
});
