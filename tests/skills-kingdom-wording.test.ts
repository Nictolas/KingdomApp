import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Competenze usa Regno e non Colonia", () => {
  const source = readFileSync("app/competenze.tsx", "utf8");

  assert.match(source, /competenze riconosciute nel regno/i);
  assert.doesNotMatch(source, /competenze riconosciute nella colonia/i);
});
