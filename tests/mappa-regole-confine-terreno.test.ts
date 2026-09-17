import assert from "node:assert/strict";
import test from "node:test";
import { applicaRegoleConfineTerreno } from "../src/game/mappaRegoleConfineTerreno";
import { GIACIMENTO, STRADA_OPZIONE } from "../src/game/mappaEdificiStatici";
import type { EdificioInCellaMappa } from "../src/game/mappaTypes";

test("terrain boundary rules can skip automatic road reconnection", () => {
  const edifici: Record<number, EdificioInCellaMappa> = {
    27: { id: 9001, nome: "Edificio test", emoji: "" }
  };
  const terreno = {};

  applicaRegoleConfineTerreno(edifici, terreno, 8, 8, {
    collegaEdificiAllaStrada: false
  });

  assert.equal(Object.values(edifici).some((e) => e?.nome === "Strada"), false);
});

test("terrain boundary rules preserve the historical default road reconnection", () => {
  const edifici: Record<number, EdificioInCellaMappa> = {
    27: { id: 9001, nome: "Edificio test", emoji: "" }
  };
  const terreno = {};

  applicaRegoleConfineTerreno(edifici, terreno, 8, 8);

  assert.equal(Object.values(edifici).some((e) => e?.nome === "Strada"), true);
});

test("terrain boundary rules remove coastal roads but keep Giacimento out of sand", () => {
  const edifici: Record<number, EdificioInCellaMappa> = {
    9: { ...STRADA_OPZIONE },
    10: { ...GIACIMENTO }
  };
  const terreno = {};

  applicaRegoleConfineTerreno(edifici, terreno, 8, 8, {
    collegaEdificiAllaStrada: false
  });

  assert.equal(edifici[9], undefined);
  assert.notEqual(terreno[10], "sabbia");
});
