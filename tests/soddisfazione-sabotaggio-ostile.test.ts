import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { applicaSabotaggioOstileMensile } from "../src/game/disordineSoddisfazione";
import type { Abitante, Edificio } from "../src/types";

function abitante(id: number, personalità: string, ostile: boolean): Abitante {
  return {
    id,
    nome: `Abitante ${id}`,
    emoji: "🙂",
    eta: 30,
    lavoro: "Disoccupato",
    competenza: 50,
    produttività: 50,
    stanchezza: 0,
    personalità,
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
  } as unknown as Edificio;
}

test("un Ostile da sabotaggio riduce di 8 l'efficienza di un edificio", () => {
  const sabotatore = abitante(2, "Pragmatico", true);
  const officina = edificio(10, "Officina", "Produzione", 80);

  const result = applicaSabotaggioOstileMensile(
    [sabotatore],
    [officina],
    31,
    2,
    0,
    () => 0
  );

  assert.equal(result.sabotatoreId, 2);
  assert.equal(result.edificioId, 10);
  assert.equal(result.edifici[0]?.efficienza, 72);
  assert.match(result.messaggio ?? "", /Sabotaggio/);
});

test("il sabotaggio non scende sotto efficienza 40", () => {
  const sabotatore = abitante(2, "Tiepido", true);
  const officina = edificio(10, "Officina", "Produzione", 44);

  const result = applicaSabotaggioOstileMensile(
    [sabotatore],
    [officina],
    31,
    2,
    0,
    () => 0
  );

  assert.equal(result.edifici[0]?.efficienza, 40);
});

test("un Ostile destinato all'attentato non viene usato come sabotatore", () => {
  const psicopatico = abitante(2, "Psicopatico", true);
  const officina = edificio(10, "Officina", "Produzione", 80);

  const result = applicaSabotaggioOstileMensile(
    [psicopatico],
    [officina],
    31,
    2,
    0,
    () => 0
  );

  assert.equal(result.sabotatoreId, null);
  assert.equal(result.edifici[0]?.efficienza, 80);
});

test("il cambio mese automatico applica il sabotaggio e lo scrive nel Diario", () => {
  const source = readFileSync("src/hooks/useGameState.ts", "utf8");

  assert.match(source, /applicaSabotaggioOstileMensile/);
  assert.match(source, /setEdifici\(sabotaggio\.edifici\)/);
  assert.match(source, /sabotaggio\.messaggio/);
});
