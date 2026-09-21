import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Eventi usa Regno e cambio mese automatico", () => {
  const source = readFileSync("app/eventi.tsx", "utf8");

  assert.doesNotMatch(source, /Skip Mese|colonia/i);
  assert.match(source, /cambio mese automatico/i);
  assert.match(source, /in corso nel regno/i);
  assert.match(source, /aggiungersi al regno/i);
});
