import assert from "node:assert/strict";
import test from "node:test";

import {
  getOrologioGiocoVelocitaSnapshot,
  getOrologioMinutiSnapshot,
  getOrologioSimTimeScaleSnapshot,
  MINUTI_GIOCO_PER_SECONDO_REALE,
  msRealiPerMinutoGioco,
  restoreOrologioGioco,
  scalaDurataRealeMs,
  setOrologioGiocoBloccatoDallaFase,
  setOrologioGiocoInPausa,
  setOrologioGiocoVelocita,
  syncOrologioGiocoDaWallClock,
  getOrologioGiocoInPausaSnapshot
} from "../src/game/orologioGiocoSession.ts";

test("base: 1 minuto di gioco per secondo reale a ×1", () => {
  assert.equal(MINUTI_GIOCO_PER_SECONDO_REALE, 1);
  assert.equal(msRealiPerMinutoGioco(1), 1000);
  assert.equal(msRealiPerMinutoGioco(5), 200);
  assert.equal(msRealiPerMinutoGioco(10), 100);
});

test("orologio avanza di 1 minuto per secondo a ×1", () => {
  setOrologioGiocoBloccatoDallaFase(false);
  setOrologioGiocoInPausa(false);
  setOrologioGiocoVelocita(1);
  restoreOrologioGioco({ giorno: 1, minutiDaMezzanotte: 6 * 60, pausaManuale: false });

  const start = getOrologioMinutiSnapshot();
  syncOrologioGiocoDaWallClock();
  assert.equal(getOrologioMinutiSnapshot(), start);
  assert.equal(getOrologioGiocoVelocitaSnapshot(), 1);
});

test("velocità ×5 e ×10 sono impostabili", () => {
  setOrologioGiocoVelocita(5);
  assert.equal(getOrologioGiocoVelocitaSnapshot(), 5);
  setOrologioGiocoVelocita(10);
  assert.equal(getOrologioGiocoVelocitaSnapshot(), 10);
  setOrologioGiocoVelocita(1);
  assert.equal(getOrologioGiocoVelocitaSnapshot(), 1);
});

test("scala simulazione personaggi: pausa=0, velocità proporzionale", () => {
  setOrologioGiocoBloccatoDallaFase(false);
  setOrologioGiocoInPausa(false);
  setOrologioGiocoVelocita(1);
  assert.equal(getOrologioSimTimeScaleSnapshot(), 1);
  assert.equal(scalaDurataRealeMs(320, 1), 320);
  assert.equal(scalaDurataRealeMs(320, 5), 64);
  assert.equal(scalaDurataRealeMs(320, 10), 32);

  setOrologioGiocoVelocita(10);
  assert.equal(getOrologioSimTimeScaleSnapshot(), 10);

  setOrologioGiocoInPausa(true);
  assert.equal(getOrologioSimTimeScaleSnapshot(), 0);
  setOrologioGiocoInPausa(false);
  setOrologioGiocoVelocita(1);
});

test("scegliere una velocità toglie la pausa", () => {
  setOrologioGiocoBloccatoDallaFase(false);
  setOrologioGiocoInPausa(true);
  assert.equal(getOrologioGiocoInPausaSnapshot(), true);
  setOrologioGiocoVelocita(5);
  assert.equal(getOrologioGiocoInPausaSnapshot(), false);
  assert.equal(getOrologioGiocoVelocitaSnapshot(), 5);
});
