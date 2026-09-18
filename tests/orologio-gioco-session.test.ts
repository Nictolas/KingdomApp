import assert from "node:assert/strict";
import test from "node:test";
import {
  getOrologioGiocoVelocitaSnapshot,
  restoreOrologioGioco,
  setOrologioGiocoBloccatoDallaFase,
  setOrologioGiocoVelocita,
  syncOrologioGiocoDaWallClock
} from "../src/game/orologioGiocoSession";

function withFakeNow(run: (setNow: (value: number) => void) => void): void {
  const originalNow = Date.now;
  let now = 1_000_000;
  Date.now = () => now;
  try {
    run((value) => {
      now = value;
    });
  } finally {
    Date.now = originalNow;
    restoreOrologioGioco({ giorno: 1, minutiDaMezzanotte: 360, pausaManuale: false });
    setOrologioGiocoBloccatoDallaFase(true);
  }
}

test("game clock speed multiplies elapsed game minutes at 1x, 2x and 4x", () => {
  withFakeNow((setNow) => {
    restoreOrologioGioco({ giorno: 1, minutiDaMezzanotte: 360, pausaManuale: false });
    setOrologioGiocoBloccatoDallaFase(false);

    setNow(1_001_000);
    assert.equal(syncOrologioGiocoDaWallClock(), 390);

    setOrologioGiocoVelocita(2);
    assert.equal(getOrologioGiocoVelocitaSnapshot(), 2);
    setNow(1_002_000);
    assert.equal(syncOrologioGiocoDaWallClock(), 450);

    setOrologioGiocoVelocita(4);
    assert.equal(getOrologioGiocoVelocitaSnapshot(), 4);
    setNow(1_003_000);
    assert.equal(syncOrologioGiocoDaWallClock(), 570);
  });
});

test("changing speed accounts for elapsed time with the previous multiplier first", () => {
  withFakeNow((setNow) => {
    restoreOrologioGioco({ giorno: 1, minutiDaMezzanotte: 360, pausaManuale: false });
    setOrologioGiocoBloccatoDallaFase(false);

    setNow(1_001_000);
    setOrologioGiocoVelocita(2);
    assert.equal(syncOrologioGiocoDaWallClock(), 390);

    setNow(1_002_000);
    assert.equal(syncOrologioGiocoDaWallClock(), 450);
  });
});

test("restoring a save starts the session at normal 1x speed", () => {
  setOrologioGiocoVelocita(4);
  restoreOrologioGioco({ giorno: 2, minutiDaMezzanotte: 600, pausaManuale: false });
  assert.equal(getOrologioGiocoVelocitaSnapshot(), 1);
});
