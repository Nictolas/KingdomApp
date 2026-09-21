import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Età pensionabile usa Regno e non Colonia", () => {
  const source = readFileSync("app/eta-pensionabile.tsx", "utf8");

  assert.match(source, /costo per il regno/i);
  assert.doesNotMatch(source, /costo per la colonia/i);
});
