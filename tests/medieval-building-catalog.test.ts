import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { edificiData } from "../src/data/edificiData.ts";
import { EDIFICIO_COMPETENZA_RICHIESTA } from "../src/data/edificiCompetenze.ts";

test("il catalogo edifici usa il Regno medievale fantasy", () => {
  const nomi = new Set(edificiData.map((edificio) => edificio.nome));

  for (const nome of ["Castello", "Porto", "Miniera", "Emporio", "Bosco", "Zecca", "Chiesa"]) {
    assert.ok(nomi.has(nome), `Manca l'edificio medievale: ${nome}`);
  }

  for (const nome of ["Centro di Comando", "Spazioporto", "Raffineria Mineraria"]) {
    assert.equal(nomi.has(nome), false, `È ricomparso il vecchio edificio fantascientifico: ${nome}`);
  }

  assert.ok(nomi.has("Luogo di Culto delle Ombre"));
  assert.equal(nomi.has("Luogo di Culto degli Alieni"), false);
});


test("la mappa trasforma i Giacimenti in Miniere senza residui della Raffineria", () => {
  const mappa = readFileSync("app/mappa.tsx", "utf8");

  assert.equal(existsSync("app/raffineria-mineraria.tsx"), false);
  assert.match(mappa, /MINIERA_EDIFICIO/);
  assert.match(mappa, /Trasformare in Miniera/);
  assert.doesNotMatch(mappa, /Raffineria Mineraria|RAFFINERIA_MINERARIA/);
});


test("le competenze edificio non conservano ID di edifici rimossi", () => {
  assert.equal(EDIFICIO_COMPETENZA_RICHIESTA[6], undefined);
  assert.ok(EDIFICIO_COMPETENZA_RICHIESTA[3]);
  assert.ok(EDIFICIO_COMPETENZA_RICHIESTA[31]);
});
