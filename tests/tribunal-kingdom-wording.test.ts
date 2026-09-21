import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("il Tribunale usa Regno e non Colonia", () => {
  const screen = readFileSync("app/tribunale.tsx", "utf8");
  const state = readFileSync("src/hooks/useGameState.ts", "utf8");

  assert.doesNotMatch(screen, /colonia/i);
  assert.match(screen, /Imputati nel regno/);
  assert.match(screen, /Nessun imputato nel regno/);
  assert.doesNotMatch(state, /rimuove l'abitante da colonia/i);
});
