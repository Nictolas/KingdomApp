import assert from "node:assert/strict";
import test from "node:test";
import { createSaveEnvelope } from "./save-fixture.mjs";
import { serializeSave, deserializeSave } from "../src/persistence/saveSerializer";
import { ripristinaBoscoNord } from "../src/game/mappaBoscoNord";
import { buildPhaserBuildings } from "../src/phaser/adapters/buildPhaserMapSnapshot";

test("un vecchio salvataggio senza Bosco viene riparato senza alterare abitanti e risorse", () => {
  const original = createSaveEnvelope();
  const before = serializeSave(original);
  const loaded = deserializeSave(before);
  const originalPopulation = JSON.stringify(loaded.payload.population);
  const originalResources = JSON.stringify(loaded.payload.colony.risorse);
  const oldState = loaded.payload.map;
  assert.ok(!Object.values(oldState.edificiInMappa).some(e => e.nome === "Bosco"));
  const repaired = ripristinaBoscoNord(oldState, 50, 50);
  const anchor = Object.keys(repaired.edificiInMappa)
    .map(Number).find(i => repaired.edificiInMappa[i]?.nome === "Bosco" && repaired.edificiInMappa[i]?.footprintRef == null);
  assert.ok(anchor !== undefined);
  loaded.payload.map = repaired;
  const persisted = deserializeSave(serializeSave(loaded));
  assert.equal(JSON.stringify(persisted.payload.population), originalPopulation);
  assert.equal(JSON.stringify(persisted.payload.colony.risorse), originalResources);
  assert.ok(buildPhaserBuildings(persisted.payload.map, 50, 50).some(b => b.name === "Bosco"));
  assert.deepEqual(persisted.payload.map.edificiInMappa[anchor]?.footprint, { w: 5, h: 5 });
});
