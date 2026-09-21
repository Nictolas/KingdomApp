import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { EDIFICI_CATENA_PRODUTTIVA } from "../src/data/edificiCatenaProduttiva";

test("la pagina Edifici usa la catena produttiva medievale", () => {
  const pagina = readFileSync("app/edifici.tsx", "utf8");
  const nomi = EDIFICI_CATENA_PRODUTTIVA.map((e) => e.nome);

  assert.ok(nomi.includes("Falegnameria"));
  assert.ok(nomi.includes("Forgia"));
  assert.ok(nomi.includes("Taverna"));
  assert.ok(nomi.includes("Laboratorio Magico"));
  assert.match(pagina, /EDIFICI_CATENA_PRODUTTIVA/);
  assert.match(pagina, /Catena produttiva/);
  assert.doesNotMatch(pagina, /Spazioporto/);
  assert.doesNotMatch(pagina, /Centrale Energetica/);
});
