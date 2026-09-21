import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("il Mercato descrive il cambio mese automatico e non Skip Mese", () => {
  const source = readFileSync("app/mercato.tsx", "utf8");

  assert.match(source, /Ordini eseguiti al cambio mese automatico/);
  assert.doesNotMatch(source, /Skip Mese/);
});
