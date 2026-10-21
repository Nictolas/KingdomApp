import assert from "node:assert/strict";
import test from "node:test";
import { applicaCicloVitaAnnuale } from "../src/game/cicloVitaAnnuale.ts";
import { serializeSave, deserializeSave } from "../src/persistence/saveSerializer.ts";
import { createSaveEnvelope } from "./save-fixture.mjs";

test("a multi-generation dynasty can survive 35 annual changes and save every year", () => {
  const save = createSaveEnvelope();
  const first = { ...save.payload.population.abitanti[0], nome: "Prima Regina", eta: 109, lavoro: "Re", figliIds: [7], storiaSovrani: [] };
  const second = { ...first, id: 7, nome: "Secondo Re", eta: 88, lavoro: "Agricoltore", genitoriIds: [1], figliIds: [8], storiaSovrani: undefined };
  const third = { ...first, id: 8, nome: "Terza Regina", eta: 65, lavoro: "Agricoltore", genitoriIds: [7], figliIds: [], storiaSovrani: undefined };
  save.payload.population.abitanti = [first, second, third];
  save.payload.population.nextId = 9;
  let successions = 0;
  for (let year = 1; year <= 35; year++) {
    const ageChange = save.payload.population.abitanti.map(a => ({ ...a, eta: a.razza === "Golem" ? a.eta : a.eta + 1 }));
    const result = applicaCicloVitaAnnuale(ageChange, save.payload.colony.edifici, year, () => 0.99);
    if (result.successione) successions++;
    save.payload.population.abitanti = result.abitanti;
    save.payload.colony.edifici = result.edifici;
    save.payload.calendar.anno = year;
    const restored = deserializeSave(serializeSave(save));
    assert.equal(restored.payload.population.abitanti.filter(a => a.id === 1).length, 1);
    assert.equal(new Set(restored.payload.population.abitanti.map(a => a.id)).size, restored.payload.population.abitanti.length);
    save.payload = restored.payload;
  }
  assert.equal(successions, 2);
  assert.equal(save.payload.population.abitanti.find(a => a.id === 1)?.nome, "Terza Regina");
  assert.equal(save.payload.population.abitanti.find(a => a.id === 1)?.storiaSovrani?.length, 2);
});