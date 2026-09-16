import assert from "node:assert/strict";
import test from "node:test";
import { getStradeIniziali } from "../src/game/mappaStradeIniziali";
import type { EdificioInCellaMappa } from "../src/game/mappaTypes";

function edificio(
  id: number,
  nome: string,
  footprint: { w: number; h: number } | undefined,
  footprintRef?: number
): EdificioInCellaMappa {
  return { id, nome, emoji: "", footprint, footprintRef };
}

test("initial road links preserve the expected map anchors and order", () => {
  const edifici: Record<number, EdificioInCellaMappa> = {
    10: edificio(1, "Centro di Comando", { w: 3, h: 2 }),
    30: edificio(19, "Spazioporto", { w: 4, h: 3 }),
    40: edificio(2, "Serra", { w: 2, h: 1 }),
    50: edificio(21, "Serra", { w: 2, h: 1 }),
    60: edificio(12, "Tribunale", { w: 2, h: 2 }),
    70: edificio(17, "Bar", { w: 2, h: 2 })
  };

  assert.deepEqual(getStradeIniziali(edifici), [
    [10, 30],
    [10, 40],
    [10, 50],
    [10, 60],
    [10, 70]
  ]);
});

test("initial road links ignore secondary footprint cells and non-footprint fallbacks", () => {
  const edifici: Record<number, EdificioInCellaMappa> = {
    10: edificio(1, "Centro di Comando", { w: 3, h: 2 }),
    11: edificio(1, "Centro di Comando", undefined, 10),
    30: edificio(19, "Spazioporto", undefined),
    31: edificio(19, "Spazioporto", undefined, 30),
    40: edificio(2, "Serra", { w: 2, h: 1 }),
    41: edificio(2, "Serra", undefined, 40),
    60: edificio(12, "Tribunale", undefined),
    70: edificio(17, "Bar", undefined)
  };

  assert.deepEqual(getStradeIniziali(edifici), [[10, 40]]);
  assert.deepEqual(getStradeIniziali({ 40: edificio(2, "Serra", { w: 2, h: 1 }) }), []);
});
