import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { tentaAttentatoOstileMensile } from "../src/game/disordineSoddisfazione";
import type { Abitante, Edificio } from "../src/types";

function abitante(
  id: number,
  personalità: string,
  ostile = false,
  extra: Partial<Abitante> = {}
): Abitante {
  return {
    id,
    nome: id === 1 ? "Re" : `Abitante ${id}`,
    emoji: "🙂",
    eta: 30,
    lavoro: id === 1 ? "Re" : "Disoccupato",
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
      : undefined,
    ...extra
  } as Abitante;
}

function rngSequenza(valori: number[]): () => number {
  let i = 0;
  return () => valori[Math.min(i++, valori.length - 1)] ?? 0;
}

test("un Ostile Psicopatico può ferire il Re", () => {
  const re = abitante(1, "Pragmatico");
  const attentatore = abitante(2, "Psicopatico", true);

  const result = tentaAttentatoOstileMensile(
    [re, attentatore],
    [],
    31,
    2,
    0,
    rngSequenza([0, 0, 0.9])
  );

  assert.equal(result.esito.tipo, "ferito");
  assert.equal(result.abitanti.find((a) => a.id === 1)?.salute, 65);
  assert.match(result.esito.messaggio ?? "", /Attentato/);
});

test("un attentato può uccidere un Re già gravemente ferito", () => {
  const re = abitante(1, "Pragmatico", false, { salute: 30 });
  const attentatore = abitante(2, "Psicopatico", true);

  const result = tentaAttentatoOstileMensile(
    [re, attentatore],
    [],
    31,
    2,
    0,
    rngSequenza([0, 0, 0.9, 0])
  );

  assert.equal(result.esito.tipo, "mortale");
  assert.equal(result.abitanti.find((a) => a.id === 1)?.salute, 0);
  assert.match(result.esito.messaggio ?? "", /assassinato/);
});

test("tre Guardie nel Castello sventano l'attentato", () => {
  const abitanti = [
    abitante(1, "Pragmatico"),
    abitante(2, "Psicopatico", true),
    abitante(3, "Pragmatico", false, { lavoro: "Guardia" }),
    abitante(4, "Pragmatico", false, { lavoro: "Guardia" }),
    abitante(5, "Pragmatico", false, { lavoro: "Guardia" })
  ];
  const castello = {
    id: 20,
    nome: "Castello",
    tipo: "Residenza",
    stato: "Operativo",
    efficienza: 100,
    capacità: 10,
    occupazione: 4,
    abitantiAssegnati: [1, 3, 4, 5]
  } as Edificio;

  const result = tentaAttentatoOstileMensile(
    abitanti,
    [castello],
    31,
    2,
    0,
    rngSequenza([0, 0])
  );

  assert.equal(result.esito.tipo, "sventato");
  assert.equal(result.abitanti.find((a) => a.id === 1)?.salute, 100);
});

test("un Psicopatico non Ostile non tenta l'attentato", () => {
  const result = tentaAttentatoOstileMensile(
    [abitante(1, "Pragmatico"), abitante(2, "Psicopatico", false)],
    [],
    31,
    2,
    0,
    () => 0
  );

  assert.equal(result.esito.tipo, "nessuno");
});

test("il cambio mese automatico salva l'esito e lo registra nel Diario", () => {
  const source = readFileSync("src/hooks/useGameState.ts", "utf8");

  assert.match(source, /tentaAttentatoOstileMensile/);
  assert.match(source, /setAbitanti\(attentato\.abitanti\)/);
  assert.match(source, /attentato\.esito\.messaggio/);
});
