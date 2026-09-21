import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Residenze usa cambio mese automatico e Regno", () => {
  const source = readFileSync("app/residenze.tsx", "utf8");

  assert.match(source, /cambio mese automatico/i);
  assert.match(source, /Regno e catalogo unificati/);
  assert.doesNotMatch(source, /Skip Mese|Colonia e catalogo unificati/i);
});
