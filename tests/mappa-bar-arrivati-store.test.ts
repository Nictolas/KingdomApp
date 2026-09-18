import assert from "node:assert/strict";
import test from "node:test";
import {
  aggiungiAbitanteAlBarEdificio,
  rimuoviAbitanteDaTuttiBar
} from "../src/game/mappaBarArrivatiStore";

test("removing a resident from bars removes them everywhere and drops empty bar lists", () => {
  const prev = {
    10: [1, 2],
    20: [2],
    30: [3]
  };

  assert.deepEqual(rimuoviAbitanteDaTuttiBar(prev, 2), {
    10: [1],
    30: [3]
  });
  assert.deepEqual(prev, {
    10: [1, 2],
    20: [2],
    30: [3]
  });
});

test("adding a resident to a bar moves them from every previous bar", () => {
  const prev = {
    10: [1, 2],
    20: [3]
  };

  assert.deepEqual(aggiungiAbitanteAlBarEdificio(prev, 20, 2), {
    10: [1],
    20: [3, 2]
  });
});

test("adding a resident to an empty target bar creates that bar entry", () => {
  assert.deepEqual(aggiungiAbitanteAlBarEdificio({ 10: [1] }, 30, 2), {
    10: [1],
    30: [2]
  });
});
