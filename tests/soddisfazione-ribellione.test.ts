import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { applicaEffettiRibellioneMensile } from "../src/game/disordineSoddisfazione";
import type { Abitante, Edificio } from "../src/types";

function abitante(id: number, extra: Partial<Abitante> = {}): Abitante {
  return {
    id,
    nome: id === 1 ? "Re" : `Abitante ${id}`,
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
    ...extra
  } as Abitante;
}

function edificio(): Edificio {
  return {
    id: 10,
    nome: "Officina",
    tipo: "Produzione",
    stato: "Operativo",
    efficienza: 80,
    capacità: 10,
    occupazione: 2,
    abitantiAssegnati: [2, 3]
  } as Edificio;
}

function rngSequenza(valori: number[]): () => number {
  let i = 0;
  return () => valori[Math.min(i++, valori.length - 1)] ?? 0;
}

test("la Ribellione applica saccheggi, danni e possibili vittime", () => {
  const re = abitante(1);
  const vittima = abitante(2, { coniugeId: 3 });
  const coniuge = abitante(3, { coniugeId: 2 });

  const result = applicaEffettiRibellioneMensile(
    "ribellione",
    100,
    [re, vittima, coniuge],
    [edificio()],
    rngSequenza([0, 0, 0, 0])
  );

  assert.equal(result.moneteGiocatore, 60);
  assert.equal(result.edifici[0]?.efficienza, 65);
  assert.equal(result.edifici[0]?.stato, "Danneggiato");
  assert.equal(result.abitanti.some((a) => a.id === 2), false);
  assert.equal(result.abitanti.some((a) => a.id === 1), true);

  const superstite = result.abitanti.find((a) => a.id === 3)!;
  const lutto = superstite.modificatoriSoddisfazione?.find((m) => m.id === "lutto_familiare");
  assert.equal(lutto?.delta, -1);
  assert.deepEqual(result.edifici[0]?.abitantiAssegnati, [3]);
  assert.equal(result.messaggi.length >= 3, true);
});

test("fuori dalla fase Ribellione non applica effetti", () => {
  const abitanti = [abitante(1), abitante(2)];
  const edifici = [edificio()];

  const result = applicaEffettiRibellioneMensile(
    "protesta",
    100,
    abitanti,
    edifici,
    () => 0
  );

  assert.equal(result.moneteGiocatore, 100);
  assert.equal(result.abitanti, abitanti);
  assert.equal(result.edifici, edifici);
  assert.deepEqual(result.messaggi, []);
});

test("il cambio mese automatico applica la Ribellione e registra gli effetti", () => {
  const source = readFileSync("src/hooks/useGameState.ts", "utf8");

  assert.match(source, /applicaEffettiRibellioneMensile/);
  assert.match(source, /disordineDopo\.fase/);
  assert.match(source, /ribellione\.moneteGiocatore/);
  assert.match(source, /\.\.\.ribellione\.messaggi/);
});
