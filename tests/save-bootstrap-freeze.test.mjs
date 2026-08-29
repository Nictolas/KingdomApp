import assert from "node:assert/strict";
import test from "node:test";

import { isSimulationRunning } from "../src/game/gamePhase.ts";
import { getGiornoGiocoSnapshot, getOrologioMinutiSnapshot, syncOrologioGiocoDaWallClock } from "../src/game/orologioGiocoSession.ts";

test("simulazione ferma durante caricamento, ripristino e introduzione", () => {
  assert.equal(isSimulationRunning("loading"), false);
  assert.equal(isSimulationRunning("restoring"), false);
  assert.equal(isSimulationRunning("commander-creation"), false);
  assert.equal(isSimulationRunning("activating"), false);
  assert.equal(isSimulationRunning("running"), true);
});

test("l'orologio parte bloccato e non avanza durante il bootstrap", () => {
  const minutes = getOrologioMinutiSnapshot();
  const day = getGiornoGiocoSnapshot();
  syncOrologioGiocoDaWallClock();
  assert.equal(getOrologioMinutiSnapshot(), minutes);
  assert.equal(getGiornoGiocoSnapshot(), day);
});
