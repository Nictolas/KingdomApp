import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("la schermata Schiavi usa Corona e non Colonia", () => {
  const source = readFileSync("app/schiavi.tsx", "utf8");

  assert.doesNotMatch(source, /colonia/i);
  assert.match(source, /Padrone:.*Corona/s);
  assert.match(source, /Proprietà della Corona/);
  assert.match(source, /Corona uccide/);
});
