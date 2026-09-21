import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("la mappa medievale iniziale non piazza automaticamente uno Spazioporto", () => {
  const mappa = readFileSync("app/mappa.tsx", "utf8");
  assert.doesNotMatch(mappa, /aggiungiSpazioportoFootprint\(/);
});
