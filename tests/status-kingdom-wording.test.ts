import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Felicità e Lealtà confluiscono in Soddisfazione, Paura diventa Timore", () => {
  assert.match(readFileSync("app/felicita.tsx", "utf8"), /Redirect href="\/soddisfazione"/);
  assert.match(readFileSync("app/lealta.tsx", "utf8"), /Redirect href="\/soddisfazione"/);
  assert.match(readFileSync("app/paura.tsx", "utf8"), /Redirect href="\/timore"/);
  assert.match(readFileSync("app/timore.tsx", "utf8"), /Timore medio dei cittadini/);
});
