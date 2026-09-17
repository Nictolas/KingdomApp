import assert from "node:assert/strict";
import test from "node:test";

import {
  MAP_VIEWPORT_MARGIN_CELLS,
  computeVisibleCellRange,
  shouldCommitMapTransformForCulling
} from "../src/game/mapViewportCulling.ts";

test("il buffer di culling copre un trascinamento rapido prima del render successivo", () => {
  const cellPx = 40;
  const range = computeVisibleCellRange(
    800,
    600,
    { positionX: -800, positionY: -800, scale: 1 },
    50,
    50,
    cellPx
  );

  const bufferPx = MAP_VIEWPORT_MARGIN_CELLS * cellPx;
  assert.ok(bufferPx >= 600, "il prerender deve coprire almeno 600 px di pan rapido");
  assert.equal(range.colStart, 20 - MAP_VIEWPORT_MARGIN_CELLS);
  assert.equal(range.rowStart, 20 - MAP_VIEWPORT_MARGIN_CELLS);
  assert.equal(range.colEnd, 40 + MAP_VIEWPORT_MARGIN_CELLS > 50 ? 50 : 40 + MAP_VIEWPORT_MARGIN_CELLS);
  assert.equal(range.rowEnd, 35 + MAP_VIEWPORT_MARGIN_CELLS > 50 ? 50 : 35 + MAP_VIEWPORT_MARGIN_CELLS);
});

test("il buffer resta limitato ai bordi della mappa", () => {
  assert.deepEqual(
    computeVisibleCellRange(
      800,
      600,
      { positionX: 0, positionY: 0, scale: 1 },
      50,
      50,
      40
    ),
    { colStart: 0, colEnd: 36, rowStart: 0, rowEnd: 31 }
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
