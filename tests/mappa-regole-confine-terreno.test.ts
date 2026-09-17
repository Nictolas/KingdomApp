import assert from "node:assert/strict";
import test from "node:test";
import { applicaRegoleConfineTerreno } from "../src/game/mappaRegoleConfineTerreno";
import { GIACIMENTO, STRADA_OPZIONE } from "../src/game/mappaEdificiStatici";
import type { EdificioInCellaMappa } from "../src/game/mappaTypes";
import type { TerrenoType } from "../src/game/riverGeneration";

test("terrain boundary rules can skip automatic road reconnection", () => {
  const edifici: Record<number, EdificioInCellaMappa> = {
    27: { id: 9001, nome: "Edificio test", emoji: "" }
  };
  const terreno: Record<number, TerrenoType> = {};

  applicaRegoleConfineTerreno(edifici, terreno, 8, 8, {
    collegaEdificiAllaStrada: false
  });

  assert.equal(Object.values(edifici).some((e) => e?.nome === "Strada"), false);
});

test("terrain boundary rules keep road reconnection enabled by default", () => {
  const edificiDefault: Record<number, EdificioInCellaMappa> = {
    27: { id: 9001, nome: "Edificio test", emoji: "" }
  };
  const edificiExplicit: Record<number, EdificioInCellaMappa> = {
    27: { id: 9001, nome: "Edificio test", emoji: "" }
  };
  const terrenoDefault: Record<number, TerrenoType> = {};
  const terrenoExplicit: Record<number, TerrenoType> = {};

  applicaRegoleConfineTerreno(edificiDefault, terrenoDefault, 8, 8);
  applicaRegoleConfineTerreno(edificiExplicit, terrenoExplicit, 8, 8, {
    collegaEdificiAllaStrada: true
  });

  assert.deepEqual(edificiDefault, edificiExplicit);
  assert.deepEqual(terrenoDefault, terrenoExplicit);
});

test("terrain boundary rules remove coastal roads but keep Giacimento out of sand", () => {
  const edifici: Record<number, EdificioInCellaMappa> = {
    9: { ...STRADA_OPZIONE },
    10: { ...GIACIMENTO }
  };
  const terreno: Record<number, TerrenoType> = {};

  applicaRegoleConfineTerreno(edifici, terreno, 8, 8, {
    collegaEdificiAllaStrada: false
  });

  assert.equal(edifici[9], undefined);
  assert.notEqual(terreno[10], "sabbia");
});
