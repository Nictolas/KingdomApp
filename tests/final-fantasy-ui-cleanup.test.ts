import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("leggi e reati visibili usano monete invece di crediti", () => {
  const leggi = readRepoFile("src/data/leggiData.ts");
  const reati = readRepoFile("src/game/reati.ts");

  assert.doesNotMatch(leggi, /crediti accumulati/i);
  assert.match(leggi, /monete accumulate/i);
  assert.doesNotMatch(reati, /beni o crediti/i);
  assert.match(reati, /beni o monete/i);
});

test("la schermata Residenze mostra solo tipi realmente presenti nel Regno", () => {
  const source = readRepoFile("app/residenze.tsx");

  assert.match(
    source,
    /RESIDENZE_CATALOGO\.filter\(\(r\) => getEdificioByName\(r\.nome\) != null\)\.map/
  );
});
