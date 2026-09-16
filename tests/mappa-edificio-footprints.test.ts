import assert from "node:assert/strict";
import test from "node:test";

import {
  dimensioniFootprintEdificioInMappa,
  indiciFootprintProtettiIniziali,
  type MappaEdificioFootprintEntry
} from "../src/game/mappaEdificioFootprints.ts";

test("dimensioniFootprintEdificioInMappa privilegia il footprint esplicito", () => {
  const edifici: Record<number, MappaEdificioFootprintEntry> = {
    6: { nome: "Serra", footprint: { w: 3, h: 2 } }
  };
  assert.deepEqual(dimensioniFootprintEdificioInMappa(6, edifici), { w: 3, h: 2 });
});

test("dimensioniFootprintEdificioInMappa usa la tabella statica e il fallback 1x1", () => {
  const edifici: Record<number, MappaEdificioFootprintEntry> = {
    6: { nome: "Serra" },
    12: { nome: "Dormitorio" },
    18: { nome: "Edificio sconosciuto" }
  };
  assert.deepEqual(dimensioniFootprintEdificioInMappa(6, edifici), { w: 2, h: 1 });
  assert.deepEqual(dimensioniFootprintEdificioInMappa(12, edifici), { w: 2, h: 2 });
  assert.deepEqual(dimensioniFootprintEdificioInMappa(18, edifici), { w: 1, h: 1 });
  assert.deepEqual(dimensioniFootprintEdificioInMappa(24, edifici), { w: 1, h: 1 });
});

test("indiciFootprintProtettiIniziali espande solo le celle anchor", () => {
  const edifici: Record<number, MappaEdificioFootprintEntry> = {
    6: { nome: "Serra", footprint: { w: 2, h: 1 } },
    7: { nome: "Serra", footprintRef: 6 },
    12: { nome: "Dormitorio" },
    13: { nome: "Dormitorio", footprintRef: 12 },
    17: { nome: "Dormitorio", footprintRef: 12 },
    18: { nome: "Dormitorio", footprintRef: 12 },
    24: { nome: "Edificio sconosciuto" }
  };

  assert.deepEqual(
    [...indiciFootprintProtettiIniziali(edifici, 5)].sort((a, b) => a - b),
    [6, 7, 12, 13, 17, 18, 24]
  );
});
