import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  NativeResidentOverlayLookup,
  type NativeOverlayResidentIdentity,
  type NativeOverlayBarArrivals
} from "../src/performance/nativeResidentOverlayLookup.ts";

const oldNameFor = (people: readonly NativeOverlayResidentIdentity[], id: number): string =>
  people.find(person => person.id === id)?.nome ?? `ID ${id}`;
const oldAtBar = (bars: NativeOverlayBarArrivals, id: number): boolean =>
  Object.values(bars).some(ids => ids.includes(id));

test("25/50/100/200 residents: native cached accessibility labels exactly match legacy find()", () => {
  for (const count of [25, 50, 100, 200]) {
    const people = Array.from({ length: count }, (_, i) => ({
      id: 1000 + i, nome: i % 5 === 0 ? "" : "Abitante " + i
    }));
    const lookup = new NativeResidentOverlayLookup(people, {});
    for (let rep = 0; rep < 100; rep++) {
      for (const resident of people) {
        assert.equal(lookup.nameFor(resident.id), oldNameFor(people, resident.id));
      }
      assert.equal(lookup.nameFor(-123), oldNameFor(people, -123));
    }
    assert.deepEqual(lookup.snapshot(), { residentNames: count, distinctBarArrivals: 0 });
  }
});

test("native bar membership matches Object.values(...).some includes through duplicate building entries", () => {
  for (const count of [25, 50, 100, 200]) {
    const people = Array.from({ length: count }, (_, i) => ({
      id: 1000 + i, nome: "Abitante " + i
    }));
    const bars: Record<number, number[]> = {};
    for (let building = 1; building <= 12; building++) {
      bars[building] = people.filter((_, i) => i % 12 === building - 1 || i % 7 === 0)
        .map(person => person.id);
      bars[building]!.push(1000); // duplicate membership across buildings
    }
    const lookup = new NativeResidentOverlayLookup(people, bars);
    for (let iter = 0; iter < 80; iter++) {
      for (const resident of people) {
        assert.equal(lookup.hasBarArrival(resident.id), oldAtBar(bars, resident.id));
      }
      assert.equal(lookup.hasBarArrival(987654), oldAtBar(bars, 987654));
    }
    assert.ok(lookup.snapshot().distinctBarArrivals <= count);
  }
});

test("duplicate resident IDs retain first-match name and nullish legacy fallback", () => {
  const people: NativeOverlayResidentIdentity[] = [
    { id: 9, nome: "Primo" }, { id: 9, nome: "Secondo" },
    { id: 10, nome: null }, { id: 11 }, { id: 12, nome: "" }
  ];
  const lookup = new NativeResidentOverlayLookup(people, { 1: [9, 9, 10] });
  for (const id of [9, 10, 11, 12, 13]) assert.equal(lookup.nameFor(id), oldNameFor(people, id));
  assert.equal(lookup.nameFor(9), "Primo");
  assert.equal(lookup.nameFor(12), "");
  assert.deepEqual(lookup.snapshot(), { residentNames: 4, distinctBarArrivals: 2 });
});

test("Snapshot is isolated from later parent prop mutations until a new lookup is built", () => {
  const people = [{ id: 1, nome: "Prima" }, { id: 2, nome: "Seconda" }];
  const bars = { 14: [1] };
  const old = new NativeResidentOverlayLookup(people, bars);
  people[0]!.nome = "Nuova";
  bars[14]!.push(2);
  assert.equal(old.nameFor(1), "Prima");
  assert.equal(old.hasBarArrival(2), false);
  const next = new NativeResidentOverlayLookup(people, bars);
  assert.equal(next.nameFor(1), "Nuova");
  assert.equal(next.hasBarArrival(2), true);
  assert.equal(old.hasBarArrival(1), true);
});

test("SameValueZero edge cases preserve Array.includes semantics", () => {
  const bars = { 2: [Number.NaN, -0, 9] };
  const lookup = new NativeResidentOverlayLookup([], bars);
  for (const id of [Number.NaN, +0, -0, 9, 10]) {
    assert.equal(lookup.hasBarArrival(id), oldAtBar(bars, id));
  }
});

test("200 residents across 500 synthetic clock ticks and 20 immutable arrival/name updates", () => {
  let people = Array.from({ length: 200 }, (_, i) => ({ id: i + 1, nome: "R " + i }));
  let bars: Record<number, number[]> = { 1: [1, 2, 3], 2: [4, 5] };
  let lookup = new NativeResidentOverlayLookup(people, bars);
  for (let tick = 0; tick < 500; tick++) {
    if (tick > 0 && tick % 25 === 0) {
      const id = tick / 25 + 1;
      people = people.map(person => person.id === id ? { ...person, nome: "Aggiornato " + tick } : person);
      bars = { ...bars, 2: [...bars[2]!, id] };
      lookup = new NativeResidentOverlayLookup(people, bars);
    }
    for (const person of people) {
      assert.equal(lookup.nameFor(person.id), oldNameFor(people, person.id));
      assert.equal(lookup.hasBarArrival(person.id), oldAtBar(bars, person.id));
    }
  }
});

test("wiring uses native-only memoized selector; web keeps legacy scans", () => {
  const source = readFileSync(new URL("../app/mappa.tsx", import.meta.url), "utf8");
  assert.match(source, /Platform\.OS === "web"\s*\?\s*null\s*:\s*new NativeResidentOverlayLookup/);
  assert.match(source, /nativeOverlayLookup\.hasBarArrival\(abitante\.id\)/);
  assert.match(source, /Object\.values\(barArrivatiByEdificio\)\.some\(\(ids\) => ids\.includes\(abitante\.id\)\)/);
  assert.match(source, /nativeOverlayLookup\.nameFor\(abitante\.id\)/);
  assert.match(source, /getAbitanteNome\(abitante\.id\)/);
});
