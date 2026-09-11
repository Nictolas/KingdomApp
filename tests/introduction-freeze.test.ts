import assert from "node:assert/strict";
import test from "node:test";

import { isSimulationRunning, runWhenSimulationIsRunning } from "../src/game/gamePhase.ts";
import {
  getGiornoGiocoSnapshot,
  getOrologioMinutiSnapshot,
  setOrologioGiocoBloccatoDallaFase,
  syncOrologioGiocoDaWallClock
} from "../src/game/orologioGiocoSession.ts";

test("durante creazione e attivazione la simulazione resta disabilitata", () => {
  assert.equal(isSimulationRunning("commander-creation"), false);
  assert.equal(isSimulationRunning("activating"), false);
  assert.equal(isSimulationRunning("running"), true);
});

test("il blocco introduttivo mantiene immobili giorno e orologio", () => {
  setOrologioGiocoBloccatoDallaFase(true);
  const minuti = getOrologioMinutiSnapshot();
  const giorno = getGiornoGiocoSnapshot();

  syncOrologioGiocoDaWallClock();

  assert.equal(getOrologioMinutiSnapshot(), minuti);
  assert.equal(getGiornoGiocoSnapshot(), giorno);
});

test("movimenti, pasti, produzione, economia, cambio mese, eventi e richieste non partono nell'introduzione", () => {
  const effetti = {
    movimenti: 0,
    pasti: 0,
    produzione: 0,
    economia: 0,
    skipMese: 0,
    eventi: 0,
    richieste: 0
  };

  for (const key of Object.keys(effetti) as Array<keyof typeof effetti>) {
    const eseguito = runWhenSimulationIsRunning("commander-creation", () => {
      effetti[key] += 1;
    });
    assert.equal(eseguito, false);
  }

  assert.deepEqual(effetti, {
    movimenti: 0,
    pasti: 0,
    produzione: 0,
    economia: 0,
    skipMese: 0,
    eventi: 0,
    richieste: 0
  });
});

test("gli effetti automatici possono partire soltanto dalla fase running", () => {
  let richieste = 0;
  assert.equal(runWhenSimulationIsRunning("activating", () => richieste++), false);
  assert.equal(runWhenSimulationIsRunning("running", () => richieste++), true);
  assert.equal(richieste, 1);
});
