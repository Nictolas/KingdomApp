import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkpointTurniForestali, ripristinaTurniForestali } from "../src/game/forestTurnSave";
import { iniziaTurnoForestale, segnalaArrivoTurnoForestale, aggiornaTurnoForestale, type TurnoForestale } from "../src/game/turniForestali";
import type { SaveEnvelopeV1 } from "../src/persistence/saveTypes";
import { gameStateToGameSaveV1, gameSaveV1ToGameState } from "../src/persistence/gameStateMapping";
import { createSaveEnvelope } from "./save-fixture.mjs";
import { validateSaveEnvelope } from "../src/persistence/saveValidation";
import {
  getMappaPersonaggiRuntimeRevision,
  patchMappaPersonaggiRuntime,
  subscribeMappaPersonaggiRuntime,
  resetMappaPersonaggiRuntime
} from "../src/game/mappaPersonaggiRuntimeStore";

function activeTurn() {
  let turno = iniziaTurnoForestale({
    abitanteId: 17, giorno: 5, lavoro: "Raccoglitore",
    sedeId: null, minuto: 420
  });
  turno = segnalaArrivoTurnoForestale(turno, "bosco", 440);
  return aggiornaTurnoForestale(turno, 680, 960);
}

test("salvataggio Bosco: conserva i minuti reali e sospende il turno dopo riavvio", () => {
  const turno = activeTurn();
  assert.equal(turno.fase, "nel_bosco");
  assert.equal(turno.minutiNelBosco, 240);
  const original = { 17: turno };
  const checkpoint = checkpointTurniForestali(original);
  assert.notEqual(checkpoint[17], original[17]);
  const restored = ripristinaTurniForestali(JSON.parse(JSON.stringify(checkpoint)));
  assert.equal(restored[17].fase, "sospeso");
  assert.equal(restored[17].minutiNelBosco, 240);
  assert.equal(restored[17].fineFaseAlMinuto, null);
  assert.equal(original[17].fase, "nel_bosco");
});

test("salvataggio Bosco: fasi chiuse e salvataggi legacy conservano semantica", () => {
  assert.deepEqual(ripristinaTurniForestali(undefined), {});
  const turno: TurnoForestale = { ...activeTurn(), fase: "finito" };
  const loaded = ripristinaTurniForestali({ 17: turno });
  assert.equal(loaded[17].fase, "finito");
  const source = createSaveEnvelope() as unknown as SaveEnvelopeV1;
  assert.equal(source.payload.map.turniForestaliByAbitanteId, undefined);
  const old = gameSaveV1ToGameState(source.payload);
  assert.equal(old.mappa.turniForestaliByAbitanteId, undefined);
});

test("salvataggio Bosco: JSON checkpoint supera il validatore della partita", () => {
  const source = createSaveEnvelope() as unknown as SaveEnvelopeV1;
  source.payload.map.turniForestaliByAbitanteId = checkpointTurniForestali({ 17: activeTurn() });
  validateSaveEnvelope(source);
  const mapped = gameSaveV1ToGameState(source.payload);
  const roundtrip = gameStateToGameSaveV1(mapped);
  assert.equal(roundtrip.map.turniForestaliByAbitanteId?.[17]?.minutiNelBosco, 240);
});

test("salvataggio Bosco: record corrotti o teleport non verificati sono rifiutati", () => {
  const original = activeTurn();
  for (const bad of [
    { ...original, abitanteId: 18 },
    { ...original, fase: "nuova_fase" },
    { ...original, minutiNelBosco: -5 },
    { ...original, giorno: Infinity }
  ]) assert.throws(() => checkpointTurniForestali({ 17: bad as TurnoForestale }), /non valid|incoerent/);
});

test("salvataggio Bosco: revision token notifica i cambiamenti senza render aggiuntivi", () => {
  const original = getMappaPersonaggiRuntimeRevision();
  let calls = 0;
  const unsubscribe = subscribeMappaPersonaggiRuntime(() => { calls++; });
  patchMappaPersonaggiRuntime({ turniForestaliByAbitanteId: { 17: activeTurn() } });
  assert.equal(getMappaPersonaggiRuntimeRevision(), original + 1);
  assert.equal(calls, 1);
  unsubscribe();
  resetMappaPersonaggiRuntime();
  assert.equal(calls, 1);
});

test("integrazione GameContext: autosave include checkpoint e lo sospende sul recupero", () => {
  const code = readFileSync("src/context/GameContext.tsx", "utf8");
  assert.match(code, /checkpointTurniForestali\(/);
  assert.match(code, /ripristinaTurniForestali\(/);
  assert.match(code, /subscribeMappaPersonaggiRuntime\(/);
  assert.match(code, /getMappaPersonaggiRuntimeRevision\(\) !== savedRuntimeRevision/);
  assert.match(code, /const storage = await createGameSaveStorage\(\)/);
});

test("salvataggio Bosco: il validatore scarta turni corrotti prima del ripristino", () => {
  const source = createSaveEnvelope() as unknown as SaveEnvelopeV1;
  source.payload.map.turniForestaliByAbitanteId = {
    17: { ...activeTurn(), minutiNelBosco: -1 }
  };
  assert.throws(() => validateSaveEnvelope(source), /Checkpoint.*danneggiato/);
});
