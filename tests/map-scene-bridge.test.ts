import assert from "node:assert/strict";
import test from "node:test";

import { MapSceneBridge, type PhaserMapSnapshot } from "../src/phaser/adapters/mapSceneBridge.ts";

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
  const dragStates: boolean[] = [];
  const bridge = new MapSceneBridge(first, {
    onCellPress: (index) => pressed.push(index),
    onCellHover: (index) => hovered.push(index),
    onDragStateChange: (dragging) => dragStates.push(dragging)
  });

  bridge.pressCell(3);
  bridge.hoverCell(2);
  bridge.hoverCell(null);
  bridge.setDragging(true);
  bridge.setDragging(false);

  assert.deepEqual(pressed, [3]);
  assert.deepEqual(hovered, [2, null]);
  assert.deepEqual(dragStates, [true, false]);
});
