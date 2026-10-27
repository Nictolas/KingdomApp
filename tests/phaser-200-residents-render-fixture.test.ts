import assert from "node:assert/strict";
import test from "node:test";

import {
  PHASER_BENCHMARK_MAP_COLS,
  PHASER_BENCHMARK_MAP_ROWS,
  PHASER_BENCHMARK_RESIDENT_COUNT,
  createPhaser200ResidentsBenchmarkFixture
} from "../src/phaser/adapters/phaserResidentsBenchmarkFixture.ts";

test("200 rendered characters have unique ids and starting cells", () => {
  const residents = createPhaser200ResidentsBenchmarkFixture();
  assert.equal(residents.length, PHASER_BENCHMARK_RESIDENT_COUNT);
  assert.equal(new Set(residents.map((character) => character.id)).size, 200);
  assert.equal(new Set(residents.map((character) => character.cell)).size, 200);
  assert.ok(residents.every((character) => character.appearance === "golem"));
});

test("moving fixture waypoints stay in bounds and each path has continuous moves", () => {
  const residents = createPhaser200ResidentsBenchmarkFixture();
  for (const character of residents) {
    assert.ok(character.path && character.path.length >= 120);
    assert.equal(character.path[0], character.cell);
    for (let index = 0; index < character.path.length; index += 1) {
      const cell = character.path[index]!;
      assert.ok(cell >= 0 && cell < PHASER_BENCHMARK_MAP_COLS * PHASER_BENCHMARK_MAP_ROWS);
      if (index === 0) continue;
      const previous = character.path[index - 1]!;
      assert.equal(Math.abs(cell - previous), 1);
      assert.equal(Math.floor(cell / PHASER_BENCHMARK_MAP_COLS), Math.floor(previous / PHASER_BENCHMARK_MAP_COLS));
    }
  }
});

test("stress fixture is deterministic and does not reuse mutable paths", () => {
  const a = createPhaser200ResidentsBenchmarkFixture();
  const b = createPhaser200ResidentsBenchmarkFixture();
  assert.deepEqual(a, b);
  assert.notEqual(a[0]!.path, b[0]!.path);
  assert.ok(a.every((item) => item.pathToken === 1));
});
