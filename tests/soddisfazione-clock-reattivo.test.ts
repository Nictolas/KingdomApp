import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("la pagina Soddisfazione segue giorno, mese e anno correnti", () => {
  const source = readFileSync("app/soddisfazione.tsx", "utf8");

  assert.match(source, /useSyncExternalStore/);
  assert.match(source, /subscribeGiornoGioco/);
  assert.match(
    source,
    /useSyncExternalStore\(\s*subscribeGiornoGioco,\s*getGiornoGiocoSnapshot,\s*getGiornoGiocoSnapshot\s*\)/
  );
  assert.match(
    source,
    /\[abitanti, edifici, giornoGioco, mese, anno, calcolaFelicitàModificata\]/
  );
  assert.match(
    source,
    /calcolaFelicitàModificata\(a\)/
  );
});
