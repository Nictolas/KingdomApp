import assert from "node:assert/strict";
import test from "node:test";

import { applicaPastiGiornalieriPerPeriodo } from "../src/game/pastoGiornaliero";
import type { Abitante } from "../src/types";

const abitante = {
  id: 2,
  nome: "Test",
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
  inventario: [
    { itemId: "monete", quantità: 0 },
    { itemId: "mela", quantità: 1 },
    { itemId: "bistecca", quantità: 0 },
    { itemId: "latte", quantità: 0 },
    { itemId: "uovo", quantità: 0 }
  ]
} as Abitante;

test("un pasto giornaliero applica il bonus Soddisfazione", () => {
  const result = applicaPastiGiornalieriPerPeriodo([abitante], [], {}, 0, 1);
  const aggiornato = result.abitanti[0]!;
  const bonus = aggiornato.modificatoriSoddisfazione?.find((m) => m.id === "pasto_giorno");

  assert.equal(aggiornato.ultimoGiornoCiboConsumato, 1);
  assert.equal(bonus?.delta, 1);
  assert.equal(bonus?.durata, "giornaliero");
  assert.equal(bonus?.scadeGiorno, 2);
});
