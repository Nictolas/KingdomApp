import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  messaggioFaseDisordineSoddisfazione,
  valutaFaseDisordineSoddisfazione
} from "../src/game/disordineSoddisfazione";
import type { Abitante } from "../src/types";

function abitante(id: number, ostile = false): Abitante {
  return {
    id,
    nome: `Abitante ${id}`,
    emoji: "🙂",
    eta: 30,
    lavoro: id === 1 ? "Re" : "Disoccupato",
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
    modificatoriSoddisfazione: ostile
      ? [
          {
            id: "test_ostile",
            delta: -5,
            motivo: "Test",
            durata: "permanente"
          }
        ]
      : undefined
  } as Abitante;
}

test("5% di Ostili attiva la protesta", () => {
  const abitanti = [abitante(1), ...Array.from({ length: 20 }, (_, i) => abitante(i + 2, i === 0))];

  const snapshot = valutaFaseDisordineSoddisfazione(
    "nessuna",
    abitanti,
    [],
    30,
    1,
    0
  );

  assert.equal(snapshot.numOstili, 1);
  assert.equal(snapshot.popolazione, 20);
  assert.equal(snapshot.fase, "protesta");
  assert.equal(snapshot.avanzata, true);
  assert.match(messaggioFaseDisordineSoddisfazione(snapshot) ?? "", /Proteste nel regno/);
});

test("10% di Ostili attiva la ribellione", () => {
  const abitanti = [
    abitante(1),
    ...Array.from({ length: 20 }, (_, i) => abitante(i + 2, i < 2))
  ];

  const snapshot = valutaFaseDisordineSoddisfazione(
    "protesta",
    abitanti,
    [],
    31,
    2,
    0
  );

  assert.equal(snapshot.numOstili, 2);
  assert.equal(snapshot.fase, "ribellione");
  assert.equal(snapshot.avanzata, true);
  assert.match(messaggioFaseDisordineSoddisfazione(snapshot) ?? "", /Ribellione/);
});

test("il cambio mese automatico valuta le soglie Ostili e scrive nel Diario", () => {
  const source = readFileSync("src/hooks/useGameState.ts", "utf8");

  assert.match(source, /valutaFaseDisordineSoddisfazione/);
  assert.match(source, /messaggioFaseDisordineSoddisfazione/);
  assert.match(source, /avvisoDisordine/);
  assert.match(source, /setDiarioRighe/);
});
