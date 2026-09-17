import assert from "node:assert/strict";
import test from "node:test";

import {
  getPhaserDynamicSnapshotChanges,
  MapSceneBridge,
  type PhaserMapSnapshot
} from "../src/phaser/adapters/mapSceneBridge.ts";

const first: PhaserMapSnapshot = { cols: 2, rows: 2, cellSize: 40, tiles: [], buildings: [], characters: [], revision: 1 };

test("il bridge notifica Phaser soltanto quando cambia lo snapshot", () => {
  const bridge = new MapSceneBridge(first, { onCellPress: () => {} });
  let notifications = 0;
  const unsubscribe = bridge.subscribe(() => notifications++);

  bridge.setSnapshot(first);
  bridge.setSnapshot({ ...first, revision: 2 });
  unsubscribe();
  bridge.setSnapshot({ ...first, revision: 3 });

  assert.equal(notifications, 1);
  assert.equal(bridge.getSnapshot().revision, 3);
});

test("il bridge inoltra input senza trasferire regole dentro Phaser", () => {
  const pressed: number[] = [];
  const hovered: Array<number | null> = [];
  const characterPresses: Array<[number, boolean]> = [];
  const completedPaths: Array<[number, number]> = [];
  const dragStates: boolean[] = [];
  const bridge = new MapSceneBridge(first, {
    onCellPress: (index) => pressed.push(index),
    onCellHover: (index) => hovered.push(index),
    onCharacterPress: (id) => characterPresses.push([id, false]),
    onCharacterDoublePress: (id) => characterPresses.push([id, true]),
    onCharacterPathComplete: (id, token) => completedPaths.push([id, token]),
    onDragStateChange: (dragging) => dragStates.push(dragging)
  });

  bridge.pressCell(3);
  bridge.hoverCell(2);
  bridge.hoverCell(null);
  bridge.pressCharacter(7, false);
  bridge.pressCharacter(7, true);
  bridge.completeCharacterPath(7, 42);
  bridge.setDragging(true);
  bridge.setDragging(false);

  assert.deepEqual(pressed, [3]);
  assert.deepEqual(hovered, [2, null]);
  assert.deepEqual(characterPresses, [[7, false], [7, true]]);
  assert.deepEqual(completedPaths, [[7, 42]]);
  assert.deepEqual(dragStates, [true, false]);
});

test("un cambio hover aggiorna solo l'interazione Phaser", () => {
  const characters = [{ id: 1, name: "A", cell: 0 }];
  const before: PhaserMapSnapshot = {
    ...first,
    characters,
    interaction: { mode: "select", hoverCell: 0, affectedCells: [0], valid: true },
    showGrid: false
  };
  const after: PhaserMapSnapshot = {
    ...before,
    interaction: { mode: "select", hoverCell: 1, affectedCells: [1], valid: true }
  };

  assert.deepEqual(getPhaserDynamicSnapshotChanges(before, after), {
    characters: false,
    interaction: true,
    grid: false
  });
});

test("personaggi e griglia vengono segnalati solo quando cambiano i rispettivi dati", () => {
  const characters = [{ id: 1, name: "A", cell: 0 }];
  const before: PhaserMapSnapshot = {
    ...first,
    characters,
    interaction: { mode: "select", hoverCell: null, affectedCells: [], valid: false },
    showGrid: false
  };

  assert.deepEqual(
    getPhaserDynamicSnapshotChanges(before, { ...before, characters: [...characters] }),
    { characters: true, interaction: false, grid: false }
  );
  assert.deepEqual(
    getPhaserDynamicSnapshotChanges(before, { ...before, showGrid: true }),
    { characters: false, interaction: false, grid: true }
  );
});
