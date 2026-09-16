import assert from "node:assert/strict";
import test from "node:test";

import {
  cellaÈNelFootprintResidenzaMappa
} from "../src/game/residenzaMappa.ts";
import type { EdificioInCellaMappa } from "../src/game/mappaTypes.ts";

test("cellaÈNelFootprintResidenzaMappa riconosce anchor e celle secondarie della residenza", () => {
  const edifici: Record<number, EdificioInCellaMappa> = {
    6: { id: 20, nome: "Capanna", emoji: "", footprint: { w: 2, h: 1 } },
    7: { id: 20, nome: "Capanna", emoji: "", footprintRef: 6 }
  };

  assert.equal(cellaÈNelFootprintResidenzaMappa(6, edifici, 5), true);
  assert.equal(cellaÈNelFootprintResidenzaMappa(7, edifici, 5), true);
  assert.equal(cellaÈNelFootprintResidenzaMappa(8, edifici, 5), false);
});

test("cellaÈNelFootprintResidenzaMappa rifiuta edifici non residenziali e riferimenti orfani", () => {
  const edifici: Record<number, EdificioInCellaMappa> = {
    10: { id: 2, nome: "Serra", emoji: "", footprint: { w: 2, h: 1 } },
    11: { id: 2, nome: "Serra", emoji: "", footprintRef: 10 },
    12: { id: 20, nome: "Capanna", emoji: "", footprintRef: 99 },
    15: { id: 99, nome: "Baracca", emoji: "" }
  };

  assert.equal(cellaÈNelFootprintResidenzaMappa(10, edifici, 5), false);
  assert.equal(cellaÈNelFootprintResidenzaMappa(11, edifici, 5), false);
  assert.equal(cellaÈNelFootprintResidenzaMappa(12, edifici, 5), false);
  assert.equal(cellaÈNelFootprintResidenzaMappa(15, edifici, 5), true);
});
