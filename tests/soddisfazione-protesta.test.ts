import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { applicaEffettiProtestaMensile } from "../src/game/disordineSoddisfazione";
import type { Abitante, Edificio } from "../src/types";

const abitanti = [] as Abitante[];

function edificio(id: number, nome: string, tipo: string, efficienza: number): Edificio {
  return {
    id,
    nome,
    tipo,
    stato: "Operativo",
    efficienza,
    capacità: 10,
    occupazione: 0,
    abitantiAssegnati: []
  } as Edificio;
}

test("la Protesta applica gli effetti storici", () => {
  const officina = edificio(10, "Officina", "Produzione", 80);
  const result = applicaEffettiProtestaMensile(
    "protesta",
    100,
    abitanti,
    [officina],
    () => 0
  );

  assert.equal(result.moneteGiocatore, 85);
  assert.equal(result.edifici[0]?.efficienza, 72);
  assert.equal(result.abitanti, abitanti);
  assert.equal(result.messaggi.length, 2);
});

test("la Protesta non vandalizza Castello o Residenze", () => {
  const castello = edificio(20, "Castello", "Residenza", 100);
  const casa = edificio(21, "Villa", "Residenza", 100);

  const result = applicaEffettiProtestaMensile(
    "protesta",
    100,
    abitanti,
    [castello, casa],
    () => 0
  );

  assert.equal(result.moneteGiocatore, 85);
  assert.equal(result.edifici[0]?.efficienza, 100);
  assert.equal(result.edifici[1]?.efficienza, 100);
  assert.equal(result.messaggi.length, 1);
});

test("durante Protesta/Ribellione non si somma anche il sabotaggio individuale", () => {
  const source = readFileSync("src/hooks/useGameState.ts", "utf8");

  assert.match(source, /applicaEffettiProtestaMensile/);
  assert.match(source, /protesta\.edifici/);
  assert.match(source, /disordineDopo\.fase === "nessuna"/);
  assert.match(source, /applicaSabotaggioOstileMensile/);
});
