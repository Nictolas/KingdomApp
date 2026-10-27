import assert from "node:assert/strict";
import test from "node:test";

import {
  PHASER_BENCHMARK_MAP_COLS,
  PHASER_BENCHMARK_MAP_ROWS,
  PHASER_BENCHMARK_RESIDENT_COUNT,
  createPhaserResidentsBenchmarkFixture,
  parsePhaserBenchmarkResidentCount,
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
      const cell: number = character.path[index]!;
      assert.ok(cell >= 0 && cell < PHASER_BENCHMARK_MAP_COLS * PHASER_BENCHMARK_MAP_ROWS);
      if (index === 0) continue;
      const previous: number = character.path[index - 1]!;
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

test("diagnostic query accepts only explicit safe populations", () => {
  for (const count of [0, 50, 100, 200]) {
    assert.equal(parsePhaserBenchmarkResidentCount(`?perf=1&residents=${count}`), count);
  }
  assert.equal(parsePhaserBenchmarkResidentCount("?residents=200"), null);
  assert.equal(parsePhaserBenchmarkResidentCount("?perf=1&residents=201"), null);
  assert.equal(parsePhaserBenchmarkResidentCount("?perf=0&residents=200"), null);
});

test("population sweep produces unique evenly sampled characters without changing 200 baseline", () => {
  const reference = createPhaser200ResidentsBenchmarkFixture();
  for (const count of [0, 50, 100, 200]) {
    const subset = createPhaserResidentsBenchmarkFixture(count);
    assert.equal(subset.length, count);
    assert.equal(new Set(subset.map((x) => x.cell)).size, count);
    assert.equal(new Set(subset.map((x) => x.id)).size, count);
    assert.ok(subset.every((x) => reference.some((r) => r.id === x.id && r.cell === x.cell)));
  }
  assert.deepEqual(createPhaserResidentsBenchmarkFixture(200), reference);
  assert.throws(() => createPhaserResidentsBenchmarkFixture(201));
});
