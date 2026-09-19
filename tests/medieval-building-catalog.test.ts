import assert from "node:assert/strict";
import test from "node:test";

import { edificiData } from "../src/data/edificiData.ts";

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
