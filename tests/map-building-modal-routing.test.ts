import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("la mappa apre modali per gli edifici costruibili senza pagina dedicata", () => {
  const source = readRepoFile("app/mappa.tsx");

  assert.match(source, /CampoDiLavoroModal/);
  assert.match(source, /EdificioInfoModal/);
  assert.match(source, /edificio\.nome === "Campo di Lavoro"/);
  assert.match(source, /edificio\.nome === "Negozio"/);
  assert.match(source, /edificio\.nome === "Campo di Sterminio"/);
  assert.match(source, /setSelectedCampoLavoroId/);
  assert.match(source, /setSelectedEdificioInfoId/);
});

test("la modale Campo di Lavoro usa il Culto delle Ombre", () => {
  const source = readRepoFile("src/ui/CampoDiLavoroModal.tsx");

  assert.match(source, /Culto delle Ombre/);
  assert.doesNotMatch(source, /Culto degli Alieni/);
});
