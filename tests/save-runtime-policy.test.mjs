import assert from "node:assert/strict";
import test from "node:test";

import { decideStartup, runMutationThenSave, shouldAutosave, shouldConfirmNewGame } from "../src/persistence/saveRuntimePolicy.ts";
import { createSaveEnvelope } from "./save-fixture.mjs";

const none = { source: "none", save: null };
const primary = { source: "primary", save: createSaveEnvelope() };
const backup = { source: "backup", save: createSaveEnvelope() };

test("avvio senza salvataggio crea una nuova partita", () => {
  assert.equal(decideStartup(none), "start-new");
});

test("avvio con primary o backup mostra la scelta senza ripristinare automaticamente", () => {
  assert.equal(decideStartup(primary), "show-choice");
  assert.equal(decideStartup(backup), "show-choice");
});

test("nuova partita richiede conferma soltanto quando esiste un salvataggio", () => {
  assert.equal(shouldConfirmNewGame(primary), true);
  assert.equal(shouldConfirmNewGame(backup), true);
  assert.equal(shouldConfirmNewGame(none), false);
  assert.equal(shouldConfirmNewGame(null), false);
});

test("autosalvataggio richiede stato modificato, startup concluso e fase running", () => {
  assert.equal(shouldAutosave({ dirty: true, phase: "running", startupActive: true }), true);
  assert.equal(shouldAutosave({ dirty: false, phase: "running", startupActive: true }), false);
  assert.equal(shouldAutosave({ dirty: true, phase: "loading", startupActive: true }), false);
  assert.equal(shouldAutosave({ dirty: true, phase: "restoring", startupActive: true }), false);
  assert.equal(shouldAutosave({ dirty: true, phase: "running", startupActive: false }), false);
});

test("Skip Mese termina prima del salvataggio critico", async () => {
  const calls = [];
  await runMutationThenSave(async () => { calls.push("mese"); }, async () => { calls.push("salva"); });
  assert.deepEqual(calls, ["mese", "salva"]);
});
