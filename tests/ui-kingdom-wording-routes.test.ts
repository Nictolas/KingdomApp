import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("il profilo abitante usa la pagina Razze e wording della Corona", () => {
  const source = readRepoFile("src/ui/AbitanteInfoModal.tsx");

  assert.match(source, /apriPagina\("\/razze"\)/);
  assert.doesNotMatch(source, /apriPagina\("\/pianeti"\)/);
  assert.match(source, /Corona compra/);
  assert.match(source, /Corona uccide/);
  assert.match(source, /\? "Corona"/);
});

test("le modali principali usano wording Regno e monete", () => {
  const capanna = readRepoFile("src/ui/CapannaFullscreenModal.tsx");
  const eventi = readRepoFile("src/ui/EventiModal.tsx");
  const crediti = readRepoFile("src/ui/CreditiModal.tsx");

  assert.match(capanna, /Residenza del Regno/);
  assert.match(eventi, /altri possibili nel regno/);
  assert.match(crediti, /monete del Regno/);
  assert.match(crediti, /Saldo monete/);
  assert.match(crediti, />monete<\/Text>/);
});

test("il Tesoro non conserva route degli edifici rimossi", () => {
  const source = readRepoFile("app/crediti.tsx");

  assert.doesNotMatch(source, /Centrale Energetica|centrale-energetica/);
  assert.doesNotMatch(source, /Raffineria Mineraria|raffineria-mineraria/);
  assert.doesNotMatch(source, /Centro di Comando/);
});
