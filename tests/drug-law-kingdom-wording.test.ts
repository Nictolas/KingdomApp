import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Legge droghe usa Regno e non Colonia", () => {
  const source = readFileSync("app/legge-droghe.tsx", "utf8");

  assert.match(source, /vietate nel regno/i);
  assert.match(source, /stupefacenti nel regno/i);
  assert.doesNotMatch(source, /nella colonia/i);
});
