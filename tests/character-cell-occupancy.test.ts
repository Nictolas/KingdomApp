import assert from "node:assert/strict";
import test from "node:test";

import { assignUniqueCharacterCells } from "../src/game/characterCellOccupancy.ts";

test("due abitanti sulla stessa casella ricevono celle esclusive", () => {
  const result = assignUniqueCharacterCells(
    [{ id: 1, cell: 6 }, { id: 2, cell: 6 }, { id: 3, cell: 6 }],
    5,
    5,
    () => true
  );
  assert.equal(new Set(result.map((item) => item.cell)).size, 3);
  assert.equal(result[0].cell, 6);
});

test("la riallocazione evita edifici e aggiorna l'inizio del percorso", () => {
  const result = assignUniqueCharacterCells(
    [{ id: 1, cell: 6 }, { id: 2, cell: 6, path: [6, 7, 8] }],
    5,
    5,
    (cell) => cell !== 1 && cell !== 5 && cell !== 7
  );
  assert.equal(result[1].cell, 11);
  assert.deepEqual(result[1].path, [11, 7, 8]);
});
