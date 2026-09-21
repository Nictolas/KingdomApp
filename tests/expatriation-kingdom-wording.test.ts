import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Divieto di espatrio usa Regno e non Colonia", () => {
  const source = readFileSync("app/divieto-espatrio.tsx", "utf8");

  assert.match(source, /lasciare il regno/);
  assert.doesNotMatch(source, /lasciare la colonia/);
});
