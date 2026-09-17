import assert from "node:assert/strict";
import test from "node:test";

import {
  MAP_VIEWPORT_BASE_MARGIN_CELLS,
  MAP_VIEWPORT_MARGIN_CELLS,
  computeDirectionalCullingMargins,
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

test("l'overscan adattivo mantiene 16 celle davanti al pan e ne usa 8 sugli altri lati", () => {
  assert.deepEqual(
    computeDirectionalCullingMargins(
      { positionX: -400, positionY: -400, scale: 1 },
      { positionX: -440, positionY: -400, scale: 1 }
    ),
    {
      left: MAP_VIEWPORT_BASE_MARGIN_CELLS,
      right: MAP_VIEWPORT_MARGIN_CELLS,
      top: MAP_VIEWPORT_BASE_MARGIN_CELLS,
      bottom: MAP_VIEWPORT_BASE_MARGIN_CELLS
    }
  );
});

test("un'inversione di pan conserva per un aggiornamento il margine massimo sui due lati", () => {
  assert.deepEqual(
    computeDirectionalCullingMargins(
      {
        positionX: -440,
        positionY: -400,
        scale: 1,
        cullingMargins: {
          left: MAP_VIEWPORT_BASE_MARGIN_CELLS,
          right: MAP_VIEWPORT_MARGIN_CELLS,
          top: MAP_VIEWPORT_BASE_MARGIN_CELLS,
          bottom: MAP_VIEWPORT_BASE_MARGIN_CELLS
        }
      },
      { positionX: -400, positionY: -400, scale: 1 }
    ),
    {
      left: MAP_VIEWPORT_MARGIN_CELLS,
      right: MAP_VIEWPORT_MARGIN_CELLS,
      top: MAP_VIEWPORT_BASE_MARGIN_CELLS,
      bottom: MAP_VIEWPORT_BASE_MARGIN_CELLS
    }
  );
});

test("durante lo zoom il margine resta prudenzialmente simmetrico", () => {
  assert.deepEqual(
    computeDirectionalCullingMargins(
      { positionX: -400, positionY: -400, scale: 1 },
      { positionX: -400, positionY: -400, scale: 1.2 }
    ),
    {
      left: MAP_VIEWPORT_MARGIN_CELLS,
      right: MAP_VIEWPORT_MARGIN_CELLS,
      top: MAP_VIEWPORT_MARGIN_CELLS,
      bottom: MAP_VIEWPORT_MARGIN_CELLS
    }
  );
});

test("l'overscan direzionale riduce sensibilmente le celle prerenderizzate lontano dai bordi", () => {
  const previous = { positionX: -1200, positionY: -1200, scale: 1 };
  const next = { positionX: -1240, positionY: -1240, scale: 1 };
  const cullingMargins = computeDirectionalCullingMargins(previous, next);
  const adaptive = computeVisibleCellRange(
    800,
    600,
    { ...next, cullingMargins },
    100,
    100,
    40
  );
  const symmetric = computeVisibleCellRange(800, 600, next, 100, 100, 40, MAP_VIEWPORT_MARGIN_CELLS);
  const adaptiveCells = (adaptive.colEnd - adaptive.colStart) * (adaptive.rowEnd - adaptive.rowStart);
  const symmetricCells = (symmetric.colEnd - symmetric.colStart) * (symmetric.rowEnd - symmetric.rowStart);

  assert.ok(adaptiveCells < symmetricCells * 0.75, `${adaptiveCells} deve essere < 75% di ${symmetricCells}`);
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
