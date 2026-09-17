import assert from "node:assert/strict";
import test from "node:test";

import {
  MAP_VIEWPORT_MARGIN_CELLS,
  MAP_VIEWPORT_TARGET_SCREEN_MARGIN_CELLS,
  computeViewportMarginCells,
  computeVisibleCellRange,
  shouldCommitMapTransformForCulling
} from "../src/game/mapViewportCulling.ts";

test("l'overscan mantiene una protezione minima costante sullo schermo", () => {
  const cellPx = 40;

  assert.equal(computeViewportMarginCells(0.5), 16);
  assert.equal(computeViewportMarginCells(1), 8);
  assert.equal(computeViewportMarginCells(2), 4);
  assert.equal(computeViewportMarginCells(3), 3);

  for (const scale of [0.5, 1, 2, 3]) {
    const marginCells = computeViewportMarginCells(scale);
    const screenBufferPx = marginCells * cellPx * scale;
    const targetBufferPx = MAP_VIEWPORT_TARGET_SCREEN_MARGIN_CELLS * cellPx;
    assert.ok(
      screenBufferPx >= targetBufferPx,
      `buffer insufficiente a zoom ${scale}: ${screenBufferPx}px < ${targetBufferPx}px`
    );
  }
});

test("a zoom minimo conserva le 16 celle storiche di protezione fast-drag", () => {
  const cellPx = 40;
  const range = computeVisibleCellRange(
    800,
    600,
    { positionX: -400, positionY: -400, scale: 0.5 },
    50,
    50,
    cellPx
  );

  assert.equal(computeViewportMarginCells(0.5), MAP_VIEWPORT_MARGIN_CELLS);
  assert.deepEqual(range, { colStart: 4, colEnd: 50, rowStart: 4, rowEnd: 50 });
});

test("a zoom 1 dimezza l'overscan rispetto al vecchio margine fisso", () => {
  const adaptive = computeVisibleCellRange(
    800,
    600,
    { positionX: -600, positionY: -600, scale: 1 },
    50,
    50,
    40
  );
  const legacyFixed = computeVisibleCellRange(
    800,
    600,
    { positionX: -600, positionY: -600, scale: 1 },
    50,
    50,
    40,
    MAP_VIEWPORT_MARGIN_CELLS
  );

  const adaptiveCells = (adaptive.colEnd - adaptive.colStart) * (adaptive.rowEnd - adaptive.rowStart);
  const legacyCells =
    (legacyFixed.colEnd - legacyFixed.colStart) * (legacyFixed.rowEnd - legacyFixed.rowStart);

  assert.deepEqual(adaptive, { colStart: 7, colEnd: 43, rowStart: 7, rowEnd: 38 });
  assert.deepEqual(legacyFixed, { colStart: 0, colEnd: 50, rowStart: 0, rowEnd: 46 });
  assert.equal(adaptiveCells, 1116);
  assert.equal(legacyCells, 2300);
  assert.ok(adaptiveCells < legacyCells * 0.5, "il numero di celle deve ridursi di oltre il 50%");
});

test("il buffer adattivo resta limitato ai bordi della mappa", () => {
  assert.deepEqual(
    computeVisibleCellRange(
      800,
      600,
      { positionX: 0, positionY: 0, scale: 1 },
      50,
      50,
      40
    ),
    { colStart: 0, colEnd: 28, rowStart: 0, rowEnd: 23 }
  );
});

test("movimenti che restano nello stesso range di celle non richiedono un render React", () => {
  assert.equal(
    shouldCommitMapTransformForCulling(
      800,
      600,
      { positionX: -1, positionY: -1, scale: 1 },
      { positionX: -20, positionY: -20, scale: 1 },
      50,
      50,
      40
    ),
    false
  );

  assert.equal(
    shouldCommitMapTransformForCulling(
      800,
      600,
      { positionX: -20, positionY: -20, scale: 1 },
      { positionX: -41, positionY: -41, scale: 1 },
      50,
      50,
      40
    ),
    true
  );
});

test("un drag di 400 px non forza un render React per ogni evento transform", () => {
  let committed = { positionX: 0, positionY: 0, scale: 1 };
  let commits = 0;

  for (let x = -1; x >= -400; x--) {
    const next = { positionX: x, positionY: 0, scale: 1 };
    if (
      shouldCommitMapTransformForCulling(
        800,
        600,
        committed,
        next,
        50,
        50,
        40
      )
    ) {
      committed = next;
      commits++;
    }
  }

  assert.ok(commits <= 12, `attesi al massimo 12 commit di culling, ricevuti ${commits}`);
  assert.ok(commits < 400, "il culling deve eliminare gli aggiornamenti transform ridondanti");
});

test("prima di conoscere il viewport il transform viene comunque conservato", () => {
  assert.equal(
    shouldCommitMapTransformForCulling(
      0,
      0,
      { positionX: 0, positionY: 0, scale: 1 },
      { positionX: -120, positionY: -80, scale: 1.2 },
      50,
      50,
      40
    ),
    true
  );
});
