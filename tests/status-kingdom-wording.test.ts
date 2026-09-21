import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Felicità, Lealtà e Paura usano Regno e non Colonia", () => {
  for (const path of ["app/felicita.tsx", "app/lealta.tsx", "app/paura.tsx"]) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /colonia/i);
  }

  assert.match(readFileSync("app/felicita.tsx", "utf8"), /Felicità media \(regno\)/);
  assert.match(readFileSync("app/lealta.tsx", "utf8"), /Lealtà media \(regno\)/);
  assert.match(readFileSync("app/paura.tsx", "utf8"), /Paura media \(regno\)/);
});
