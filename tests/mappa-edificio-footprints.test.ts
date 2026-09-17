import assert from "node:assert/strict";
import test from "node:test";

import {
  aggiungiComplessoAmministrativo,
  applicaEdificioFootprintCostruzione,
  dimensioniFootprintEdificioInMappa,
  giacimentoIndicesDaEdifici,
  indiciFootprintProtettiIniziali,
  rimuoviFootprintEdificioDaMappa,
  type MappaEdificioFootprintEntry
} from "../src/game/mappaEdificioFootprints.ts";
import type { EdificioInCellaMappa } from "../src/game/mappaTypes.ts";

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

test("giacimentoIndicesDaEdifici restituisce solo le celle Giacimento", () => {
  const edifici = {
    3: { nome: "Giacimento" },
    5: { nome: "Serra" },
    9: { nome: "Giacimento" }
  };
  assert.deepEqual([...giacimentoIndicesDaEdifici(edifici)].sort((a, b) => a - b), [3, 9]);
});

test("rimuoviFootprintEdificioDaMappa elimina solo il rettangolo richiesto", () => {
  const edifici: Record<number, string> = {
    6: "a",
    7: "b",
    11: "c",
    12: "d",
    20: "keep"
  };
  rimuoviFootprintEdificioDaMappa(edifici, 6, 2, 2, 5);
  assert.deepEqual(edifici, { 20: "keep" });
});

test("aggiungiComplessoAmministrativo scrive il footprint 3x2 sul solo anchor scelto", () => {
  const edifici: Record<number, EdificioInCellaMappa> = {
    20: { id: 99, nome: "Da conservare", emoji: "🧱" }
  };

  aggiungiComplessoAmministrativo(5, 5, edifici, 6);

  assert.deepEqual(edifici[6], {
    id: 1,
    nome: "Centro di Comando",
    emoji: "🏛️",
    footprint: { w: 3, h: 2 }
  });
  for (const i of [7, 8, 11, 12, 13]) {
    assert.deepEqual(edifici[i], {
      id: 1,
      nome: "Centro di Comando",
      emoji: "",
      footprintRef: 6
    });
  }
  assert.deepEqual(edifici[20], { id: 99, nome: "Da conservare", emoji: "🧱" });
});

test("applicaEdificioFootprintCostruzione scrive correttamente 1x1 e multi-cella", () => {
  const edifici: Record<number, EdificioInCellaMappa> = {};

  applicaEdificioFootprintCostruzione(edifici, 3, 1, 1, 5, {
    id: 99,
    nome: "Singolo",
    emoji: "🧱",
    edificioGlobaleId: 700
  });
  assert.deepEqual(edifici[3], {
    id: 99,
    nome: "Singolo",
    emoji: "🧱",
    edificioGlobaleId: 700
  });

  applicaEdificioFootprintCostruzione(edifici, 6, 2, 2, 5, {
    id: 12,
    nome: "Tribunale",
    emoji: "⚖️",
    edificioGlobaleId: 701
  });
  assert.deepEqual(edifici[6], {
    id: 12,
    nome: "Tribunale",
    emoji: "",
    footprint: { w: 2, h: 2 },
    edificioGlobaleId: 701
  });
  for (const i of [7, 11, 12]) {
    assert.deepEqual(edifici[i], {
      id: 12,
      nome: "Tribunale",
      emoji: "",
      footprintRef: 6,
      edificioGlobaleId: 701
    });
  }
});
