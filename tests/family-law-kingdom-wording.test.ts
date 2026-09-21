import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Legge famiglie usa Regno e non Colonia", () => {
  const source = readFileSync("app/legge-famiglie.tsx", "utf8");

  assert.match(source, /riconosciute legalmente nel regno/i);
  assert.doesNotMatch(source, /riconosciute legalmente nella colonia/i);
});
