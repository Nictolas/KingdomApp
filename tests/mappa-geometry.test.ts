import assert from "node:assert/strict";
import test from "node:test";

import {
  expandAxisToUnitSteps,
  getIndiciCuscinoErba,
  getIndiciFootprint,
  getManhattanPathSegments,
  getVicini8,
  isAcqua,
  riverSetDaTerreno
} from "../src/game/mappaGeometry.ts";

test("isAcqua riconosce solo il bordo esterno", () => {
  assert.equal(isAcqua(0, 5, 5), true);
  assert.equal(isAcqua(4, 5, 5), true);
  assert.equal(isAcqua(20, 5, 5), true);
  assert.equal(isAcqua(24, 5, 5), true);
  assert.equal(isAcqua(6, 5, 5), false);
  assert.equal(isAcqua(12, 5, 5), false);
});

test("getIndiciFootprint mantiene l'ordine corrente delle celle", () => {
  assert.deepEqual(getIndiciFootprint(6, 2, 2, 5), [6, 7, 11, 12]);
  assert.deepEqual(getIndiciFootprint(12, 3, 1, 5), [12, 13, 14]);
});

test("getVicini8 rispetta centro e bordi", () => {
  assert.deepEqual(getVicini8(12, 5, 5), [6, 7, 8, 11, 13, 16, 17, 18]);
  assert.deepEqual(getVicini8(0, 5, 5), [1, 5, 6]);
});

test("getIndiciCuscinoErba produce lo stesso anello senza includere il footprint", () => {
  assert.deepEqual(
    getIndiciCuscinoErba(6, 2, 2, 5, 5),
    [0, 1, 2, 3, 5, 8, 10, 13, 15, 16, 17, 18]
  );
});


test("riverSetDaTerreno raccoglie solo le celle river", () => {
  assert.deepEqual(
    [...riverSetDaTerreno({ 0: "erba", 1: "river", 2: "sabbia", 8: "river" })],
    [1, 8]
  );
  assert.deepEqual([...riverSetDaTerreno({ 0: "erba", 4: "sabbia" })], []);
});


test("expandAxisToUnitSteps restituisce solo segmenti adiacenti", () => {
  assert.deepEqual(expandAxisToUnitSteps(6, 9, 5), [[6, 7], [7, 8], [8, 9]]);
  assert.deepEqual(expandAxisToUnitSteps(16, 6, 5), [[16, 11], [11, 6]]);
  assert.deepEqual(expandAxisToUnitSteps(6, 12, 5), []);
});

test("getManhattanPathSegments conserva il percorso a L corrente", () => {
  assert.deepEqual(getManhattanPathSegments(6, 18, 5), [
    [6, 7],
    [7, 8],
    [8, 13],
    [13, 18]
  ]);
  assert.deepEqual(getManhattanPathSegments(18, 6, 5), [
    [18, 17],
    [17, 16],
    [16, 11],
    [11, 6]
  ]);
  assert.deepEqual(getManhattanPathSegments(12, 12, 5), []);
});
