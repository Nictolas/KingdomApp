import assert from "node:assert/strict";
import test from "node:test";
import { applicaCicloVitaAnnuale } from "../src/game/cicloVitaAnnuale.ts";
import { serializeSave, deserializeSave } from "../src/persistence/saveSerializer.ts";
import { createSaveEnvelope } from "./save-fixture.mjs";

test("succession survives real save roundtrip", () => {
  const save = createSaveEnvelope();
  const king = { ...save.payload.population.abitanti[0], nome: "Vecchio Re", eta: 110, figliIds: [7], lavoro: "Re" };
  const heir = { ...king, id: 7, nome: "Erede", eta: 25, lavoro: "Agricoltore", figliIds: [9], genitoriIds: [1] };
  const child = { ...king, id: 9, nome: "Nipote", eta: 4, lavoro: "Bambino", figliIds: [], genitoriIds: [7] };
  const result = applicaCicloVitaAnnuale([king, heir, child], save.payload.colony.edifici, 12, () => 0.99);
  assert.equal(result.successione?.erede, "Erede");
  save.payload.population.abitanti = result.abitanti;
  save.payload.population.nextId = 10;
  save.payload.colony.edifici = result.edifici;
  const restored = deserializeSave(serializeSave(save));
  assert.equal(restored.payload.population.abitanti.find(a => a.id === 1)?.nome, "Erede");
  assert.deepEqual(restored.payload.population.abitanti.find(a => a.id === 9)?.genitoriIds, [1]);
  assert.equal(restored.payload.population.abitanti.find(a => a.id === 1)?.storiaSovrani?.length, 1);
});

test("natural death keeps saved family references valid", () => {
  const save = createSaveEnvelope();
  const king = save.payload.population.abitanti[0];
  const dead = { ...king, id: 7, eta: 110, figliIds: [8], amici: [], rivali: [] };
  const child = { ...king, id: 8, eta: 24, genitoriIds: [7], figliIds: [], amici: [{ id: 7, punteggio: 80 }], rivali: [] };
  const out = applicaCicloVitaAnnuale([king, dead, child], save.payload.colony.edifici, 12);
  save.payload.population.abitanti = out.abitanti;
  save.payload.population.nextId = 9;
  save.payload.colony.edifici = out.edifici;
  const restored = deserializeSave(serializeSave(save));
  assert.deepEqual(restored.payload.population.abitanti.find(a => a.id === 8)?.genitoriIds, []);
});