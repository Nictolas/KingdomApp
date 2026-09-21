import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Crimine usa Regno e non Colonia", () => {
  const source = readFileSync("app/crimine.tsx", "utf8");

  assert.match(source, /Reati presenti nel regno/);
  assert.doesNotMatch(source, /Reati presenti nella colonia/);
});
