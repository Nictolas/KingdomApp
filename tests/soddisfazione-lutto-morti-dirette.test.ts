import assert from "node:assert/strict";
import test from "node:test";

import { condannaAMortePuro } from "../src/game/tribunale";
import { uccidiSchiavoPuro } from "../src/game/schiavituCommercio";
import type { Abitante, Edificio } from "../src/types";

function abitante(id: number, nome: string, extra: Partial<Abitante> = {}): Abitante {
  return {
    id,
    nome,
    emoji: "🙂",
    eta: 30,
    lavoro: "Disoccupato",
    competenza: 50,
    produttività: 50,
    stanchezza: 0,
    personalità: "Pragmatico",
    amici: [],
    rivali: [],
    fazioni: [],
    peso: 50,
    salute: 100,
    reddito: 0,
    spese: 0,
    lealtà: 50,
    paura: 0,
    felicità: 50,
    religione: "Ateo",
    ...extra
  } as Abitante;
}

const edifici: Edificio[] = [];

test("la pena di morte applica il lutto familiare", () => {
  const condannato = abitante(2, "Condannato", { coniugeId: 3 });
  const coniuge = abitante(3, "Coniuge");

  const result = condannaAMortePuro([condannato, coniuge], edifici, 2);

  assert.equal(result.nuoviAbitanti.some((a) => a.id === 2), false);
  const superstite = result.nuoviAbitanti.find((a) => a.id === 3)!;
  const lutto = superstite.modificatoriSoddisfazione?.find((m) => m.id === "lutto_familiare");
  assert.equal(lutto?.delta, -1);
  assert.equal(lutto?.durata, "permanente");
});

test("l'uccisione di uno schiavo applica lo stesso lutto familiare", () => {
  const schiavo = abitante(2, "Schiavo", {
    casta: "Servo della gleba",
    ruoloSchiavitu: "schiavo",
    coniugeId: 3
  });
  const coniuge = abitante(3, "Coniuge");

  const result = uccidiSchiavoPuro({
    abitanti: [schiavo, coniuge],
    edifici,
    uccisoreId: null,
    schiavoId: 2
  });

  assert.equal(result.ok, true);
  assert.equal(result.abitanti.some((a) => a.id === 2), false);
  const superstite = result.abitanti.find((a) => a.id === 3)!;
  const lutto = superstite.modificatoriSoddisfazione?.find((m) => m.id === "lutto_familiare");
  assert.equal(lutto?.delta, -1);
  assert.equal(lutto?.durata, "permanente");
});
