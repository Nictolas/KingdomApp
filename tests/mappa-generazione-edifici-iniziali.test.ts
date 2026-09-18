import assert from "node:assert/strict";
import test from "node:test";

import { getInitialEdificiInMappa } from "../src/game/mappaGenerazioneEdificiIniziali.ts";
import { isAcqua } from "../src/game/mappaGeometry.ts";
import { scegliAnchorComplessoAmministrativo } from "../src/game/mappaPiazzamentoFootprint.ts";

test("la generazione iniziale mantiene edifici e risorse fuori dall'acqua", () => {
  const cols = 50;
  const rows = 50;
  const edifici = getInitialEdificiInMappa(
    cols,
    rows,
    new Set<number>(),
    scegliAnchorComplessoAmministrativo(cols, rows),
    () => 0.5
  );

  for (const index of Object.keys(edifici).map(Number)) {
    assert.equal(isAcqua(index, cols, rows), false, `cella ${index} non deve essere acqua`);
  }
});

test("la generazione procedurale è testabile con una sorgente casuale deterministica", () => {
  const cols = 50;
  const rows = 50;
  const edifici = getInitialEdificiInMappa(
    cols,
    rows,
    new Set<number>(),
    scegliAnchorComplessoAmministrativo(cols, rows),
    () => 0.5
  );

  const primari = Object.values(edifici).filter((edificio) => edificio.footprintRef == null);
  assert.equal(primari.filter((edificio) => edificio.nome === "Capanna").length, 7);
  assert.equal(primari.filter((edificio) => edificio.nome === "Giacimento").length, 4);

  for (const edificio of Object.values(edifici)) {
    if (edificio.footprintRef == null) continue;
    assert.ok(edifici[edificio.footprintRef], "ogni cella secondaria deve puntare a un anchor esistente");
  }
});
