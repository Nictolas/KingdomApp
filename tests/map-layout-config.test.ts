import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_FOOTPRINT_H,
  ADMIN_FOOTPRINT_W,
  BAR_FOOTPRINT_H,
  BAR_FOOTPRINT_W,
  CAPANNA_FOOTPRINT_H,
  CAPANNA_FOOTPRINT_W,
  CELL_SIZE_PX,
  DOPPIO_TAP_MS,
  FIXED_MAP_COLS,
  FIXED_MAP_ROWS,
  GAP,
  PORTO_FOOTPRINT_H,
  PORTO_FOOTPRINT_W,
  getIndiciEdificiIniziali
} from "../src/game/mappaLayoutConfig.ts";

test("configurazione base della mappa resta stabile", () => {
  assert.equal(FIXED_MAP_COLS, 50);
  assert.equal(FIXED_MAP_ROWS, 50);
  assert.equal(CELL_SIZE_PX, 40);
  assert.equal(GAP, 0);
  assert.equal(DOPPIO_TAP_MS, 400);
});

test("footprint principali mantengono le dimensioni correnti", () => {
  assert.deepEqual([ADMIN_FOOTPRINT_W, ADMIN_FOOTPRINT_H], [3, 2]);
  assert.deepEqual([PORTO_FOOTPRINT_W, PORTO_FOOTPRINT_H], [4, 3]);
  assert.deepEqual([CAPANNA_FOOTPRINT_W, CAPANNA_FOOTPRINT_H], [2, 1]);
  assert.deepEqual([BAR_FOOTPRINT_W, BAR_FOOTPRINT_H], [2, 2]);
});

test("gli edifici iniziali restano ancorati alle stesse celle nella mappa 50x50", () => {
  assert.deepEqual(getIndiciEdificiIniziali(50, 50), {
    CASTELLO_INDEX: 1225,
    TRIBUNALE_INDEX: 1275,
    SERRA_INDEX: 1224,
    SERRA_2_INDEX: 1221,
    DORMITORIO_1_INDEX: 1227,
    DORMITORIO_2_INDEX: 1175,
    DORMITORIO_3_INDEX: 1276,
    BAR_INDEX: 1328
  });
});
