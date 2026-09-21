import assert from "node:assert/strict";
import test from "node:test";

import { SaveRepository, SAVE_BACKUP_KEY, SAVE_PRIMARY_KEY, SAVE_TEMP_KEY } from "../src/persistence/saveRepository.ts";
import { deserializeSave, serializeSave } from "../src/persistence/saveSerializer.ts";
import { SaveValidationError } from "../src/persistence/saveValidation.ts";
import { MemoryPersistentStorage } from "./memory-persistent-storage.mjs";
import { createSaveEnvelope } from "./save-fixture.mjs";

test("round trip completo stato → JSON → stato", () => {
  const original = createSaveEnvelope();
  const restored = deserializeSave(serializeSave(original));
  assert.deepEqual(restored, original);
  assert.deepEqual(restored.payload.map, original.payload.map);
  assert.deepEqual(restored.payload.events, original.payload.events);
  assert.deepEqual(restored.payload.simulationCursors, original.payload.simulationCursors);
});

test("l'aspetto del Re sopravvive al salvataggio", () => {
  const save = createSaveEnvelope();
  const aspetto = {
    coloreCapelli: "#24170f",
    stileCapelli: "trecce",
    stileOcchi: "allegri",
    colorePelle: "#87513d",
    vestiti: "ranger",
    cappello: "cappuccio"
  };
  save.payload.population.abitanti[0].razza = "Elfo";
  save.payload.population.abitanti[0].aspetto = aspetto;

  const restored = deserializeSave(serializeSave(save));

  assert.equal(restored.payload.population.abitanti[0].razza, "Elfo");
  assert.deepEqual(restored.payload.population.abitanti[0].aspetto, aspetto);
});

test("i vecchi salvataggi fantascientifici migrano ai popoli fantasy", () => {
  const save = createSaveEnvelope();
  save.payload.population.razzaNativi = "Nordici";
  save.payload.population.abitanti[0].razza = "Robot";
  save.payload.population.abitanti[0].fazioni = ["Robots"];

  const restored = deserializeSave(serializeSave(save));

  assert.equal(restored.payload.population.razzaNativi, "Elfo");
  assert.equal(restored.payload.population.abitanti[0].razza, "Golem");
  assert.deepEqual(restored.payload.population.abitanti[0].fazioni, ["Golem"]);
});

test("i vecchi riferimenti al Culto degli Alieni migrano al Culto delle Ombre", () => {
  const save = createSaveEnvelope();
  save.payload.population.abitanti[0].religione = "Culto degli Alieni";
  save.payload.population.abitanti[0].fazioni = ["Culto degli Alieni"];
  save.payload.policies.religioneDiStato = "Culto degli Alieni";

  const restored = deserializeSave(serializeSave(save));

  assert.equal(restored.payload.population.abitanti[0].religione, "Culto delle Ombre");
  assert.deepEqual(restored.payload.population.abitanti[0].fazioni, ["Culto delle Ombre"]);
  assert.equal(restored.payload.policies.religioneDiStato, "Culto delle Ombre");
});

test("i vecchi salvataggi con Finanze Coloniali migrano a Finanze del Regno", () => {
  const save = createSaveEnvelope();
  save.payload.population.abitanti[0].ministero = "Finanze Coloniali";

  const restored = deserializeSave(serializeSave(save));

  assert.equal(restored.payload.population.abitanti[0].ministero, "Finanze del Regno");
});

test("i vecchi salvataggi con capoReligiosoAlieni migrano a capoReligiosoOmbre", () => {
  const save = createSaveEnvelope();
  delete save.payload.events.capoReligiosoOmbre;
  save.payload.events.capoReligiosoAlieni = 1;

  const restored = deserializeSave(serializeSave(save));

  assert.equal(restored.payload.events.capoReligiosoOmbre, 1);
  assert.equal("capoReligiosoAlieni" in restored.payload.events, false);
});

test("i vecchi salvataggi con Ex Governatore migrano a Ex Sovrano", () => {
  const save = createSaveEnvelope();
  save.payload.population.abitanti[0].reati = ["Ex Governatore"];

  const restored = deserializeSave(serializeSave(save));

  assert.deepEqual(restored.payload.population.abitanti[0].reati, ["Ex Sovrano"]);
});

test("i vecchi salvataggi con specie aliena restano caricabili e il campo legacy viene rimosso", () => {
  const save = createSaveEnvelope();
  save.payload.population.abitanti[0].specie = "alieno";

  const restored = deserializeSave(serializeSave(save));

  assert.equal("specie" in restored.payload.population.abitanti[0], false);
});

test("i vecchi salvataggi con matrimonioUmanoRobot migrano a matrimonioConGolem", () => {
  const save = createSaveEnvelope();
  delete save.payload.policies.tipologieFamigliaAccettate.matrimonioConGolem;
  save.payload.policies.tipologieFamigliaAccettate.matrimonioUmanoRobot = true;

  const restored = deserializeSave(serializeSave(save));

  assert.equal(restored.payload.policies.tipologieFamigliaAccettate.matrimonioConGolem, true);
  assert.equal("matrimonioUmanoRobot" in restored.payload.policies.tipologieFamigliaAccettate, false);
});

test("Infinity negli scaglioni fiscali sopravvive al round trip", () => {
  const restored = deserializeSave(serializeSave(createSaveEnvelope()));
  assert.equal(restored.payload.policies.scaglioniConfig.at(-1).max, Infinity);
});

test("JSON e formato non validi vengono rifiutati", () => {
  assert.throws(() => deserializeSave("{"), SaveValidationError);
  const save = createSaveEnvelope();
  save.format = "altro-formato";
  assert.throws(() => deserializeSave(JSON.stringify(save)), /Formato salvataggio/);
});

test("una versione futura viene rifiutata", () => {
  const save = createSaveEnvelope();
  save.schemaVersion = 99;
  assert.throws(() => deserializeSave(JSON.stringify(save)), /versione futura/i);
});

test("ID duplicati e riferimenti principali invalidi vengono rifiutati", () => {
  const duplicate = createSaveEnvelope();
  duplicate.payload.population.abitanti.push({ ...duplicate.payload.population.abitanti[0] });
  assert.throws(() => serializeSave(duplicate), /ID duplicato/);

  const invalidReference = createSaveEnvelope();
  invalidReference.payload.colony.edifici[0].abitantiAssegnati = [999];
  assert.throws(() => serializeSave(invalidReference), /abitante inesistente/);
});

test("prima scrittura crea primary e rimuove temp", async () => {
  const storage = new MemoryPersistentStorage();
  await new SaveRepository(storage).save(createSaveEnvelope());
  assert.ok(await storage.getItem(SAVE_PRIMARY_KEY));
  assert.equal(await storage.getItem(SAVE_BACKUP_KEY), null);
  assert.equal(await storage.getItem(SAVE_TEMP_KEY), null);
});

test("un primary precedente valido viene copiato nel backup", async () => {
  const storage = new MemoryPersistentStorage();
  const repository = new SaveRepository(storage);
  const oldSave = createSaveEnvelope();
  await repository.save(oldSave);
  const oldPrimary = await storage.getItem(SAVE_PRIMARY_KEY);
  const nextSave = createSaveEnvelope();
  nextSave.metadata.updatedAt = "2026-08-29T12:00:00.000Z";
  await repository.save(nextSave);
  assert.equal(await storage.getItem(SAVE_BACKUP_KEY), oldPrimary);
  assert.equal(deserializeSave(await storage.getItem(SAVE_PRIMARY_KEY)).metadata.updatedAt, nextSave.metadata.updatedAt);
});

test("un primary corrotto non sostituisce un backup valido", async () => {
  const storage = new MemoryPersistentStorage();
  const validBackup = serializeSave(createSaveEnvelope());
  storage.values.set(SAVE_BACKUP_KEY, validBackup);
  storage.values.set(SAVE_PRIMARY_KEY, "{corrotto");
  await new SaveRepository(storage).save(createSaveEnvelope());
  assert.equal(await storage.getItem(SAVE_BACKUP_KEY), validBackup);
});

test("un temp invalido non sostituisce primary e backup", async () => {
  const storage = new MemoryPersistentStorage();
  const primary = serializeSave(createSaveEnvelope());
  const backupSave = createSaveEnvelope();
  backupSave.metadata.saveId = "backup";
  const backup = serializeSave(backupSave);
  storage.values.set(SAVE_PRIMARY_KEY, primary);
  storage.values.set(SAVE_BACKUP_KEY, backup);
  storage.corruptSetFor.set(SAVE_TEMP_KEY, "non-json");

  await assert.rejects(() => new SaveRepository(storage).save(createSaveEnvelope()), SaveValidationError);
  assert.equal(await storage.getItem(SAVE_PRIMARY_KEY), primary);
  assert.equal(await storage.getItem(SAVE_BACKUP_KEY), backup);
});

test("un errore di scrittura non altera primary e backup", async () => {
  const storage = new MemoryPersistentStorage();
  const primary = serializeSave(createSaveEnvelope());
  storage.values.set(SAVE_PRIMARY_KEY, primary);
  storage.failSetFor.add(SAVE_PRIMARY_KEY);

  await assert.rejects(() => new SaveRepository(storage).save(createSaveEnvelope()), /Errore simulato/);
  assert.equal(await storage.getItem(SAVE_PRIMARY_KEY), primary);
  assert.equal(await storage.getItem(SAVE_BACKUP_KEY), primary);
});


test("la modalità Creativa sopravvive al salvataggio", () => {
  const save = createSaveEnvelope();
  save.payload.gameMode = "creativa";

  const restored = deserializeSave(serializeSave(save));

  assert.equal(restored.payload.gameMode, "creativa");
});

test("i vecchi salvataggi senza modalità vengono migrati ad Avventura", () => {
  const serialized = serializeSave(createSaveEnvelope());
  const legacy = JSON.parse(serialized);
  delete legacy.payload.gameMode;

  const restored = deserializeSave(JSON.stringify(legacy));

  assert.equal(restored.payload.gameMode, "avventura");
});

test("una modalità di gioco sconosciuta viene rifiutata", () => {
  const save = createSaveEnvelope();
  save.payload.gameMode = "sconosciuta";

  assert.throws(() => serializeSave(save), /Modalità di gioco/i);
});
