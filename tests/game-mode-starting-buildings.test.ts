import assert from "node:assert/strict";
import test from "node:test";

import { edificiData } from "../src/data/edificiData.ts";
import { filtraEdificiInizialiPerModalita } from "../src/game/edificiInizialiModalita.ts";

test("Avventura parte solo con il nucleo di edifici previsto", () => {
  const edifici = filtraEdificiInizialiPerModalita(edificiData, "avventura");
  const nomi = edifici.map((e) => e.nome);

  for (const nome of [
    "Castello",
    "Serra",
    "Capanna",
    "Porto",
    "Bosco",
    "Miniera",
    "Zecca",
    "Emporio",
    "Ufficio Edile",
    "Chiesa"
  ]) {
    assert.ok(nomi.includes(nome), `Manca ${nome} in Avventura`);
  }

  assert.equal(edifici.filter((e) => e.nome === "Serra").length, 1);
  assert.equal(nomi.includes("Scuola"), false);
  assert.equal(nomi.includes("Lazzaretto"), false);
  assert.equal(nomi.includes("Ponte"), false);
});

test("Creativa mantiene gli edifici disponibili ma non i template non iniziali", () => {
  const edifici = filtraEdificiInizialiPerModalita(edificiData, "creativa");
  const nomi = edifici.map((e) => e.nome);

  assert.ok(nomi.includes("Scuola"));
  assert.ok(nomi.includes("Lazzaretto"));
  assert.equal(nomi.includes("Ponte"), false);
  assert.equal(edifici.some((e) => e.tipo === "Luogo di Culto"), false);
});
