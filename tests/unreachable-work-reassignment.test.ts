import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ricollocaSeLavoroIrraggiungibile } from "../src/game/ricollocaLavoroIrraggiungibile";
import { sediCercaLavoroDisoccupatoInOrdine } from "../src/game/commutePathsMappa";
import type { Abitante, Edificio } from "../src/types";

const lavoratore = {
  id: 70,
  nome: "Tomas",
  lavoro: "Fabbro",
  casta: "Cittadino",
  razza: "Umano",
  personalità: "Neutrale",
  competenza: 50,
  inventario: [{ itemId: "monete", quantità: 0 }]
} as Abitante;

const fucina = {
  id: 134,
  nome: "Fucina",
  stato: "Operativo",
  categoriaEconomica: "Impresa",
  capacità: 2,
  occupazione: 1,
  abitantiAssegnati: [70]
} as unknown as Edificio;

const emporio = {
  id: 135,
  nome: "Emporio",
  stato: "Operativo",
  categoriaEconomica: "Impresa",
  capacità: 4,
  occupazione: 0,
  abitantiAssegnati: []
} as unknown as Edificio;

test("priorità ricollocamento include imprese e lascia Bosco come fallback finale", () => {
  const disoccupato = { ...lavoratore, lavoro: "Disoccupato" } as Abitante;
  const bosco = {
    id: 151,
    nome: "Bosco",
    stato: "Operativo",
    capacità: 20,
    occupazione: 0,
    abitantiAssegnati: []
  } as unknown as Edificio;
  const sedi = sediCercaLavoroDisoccupatoInOrdine(
    disoccupato,
    [emporio, bosco],
    [disoccupato]
  );
  assert.equal(sedi[0]?.nome, "Emporio");
  assert.equal(sedi[sedi.length - 1]?.nome, "Bosco");
});

test("lavoro senza accesso viene liberato e sostituito con una sede raggiungibile", () => {
  const map = {
    11: { id: 134, nome: "Fucina", edificioGlobaleId: 134, footprint: { w: 1, h: 1 } },
    22: { id: 135, nome: "Emporio", edificioGlobaleId: 135, footprint: { w: 1, h: 1 } }
  };
  const isWalkable = (cell: number) => cell !== 21; // porta Fucina chiusa; porta Emporio (32) libera.

  const result = ricollocaSeLavoroIrraggiungibile(
    70,
    [lavoratore],
    [fucina, emporio],
    0,
    map,
    10,
    10,
    isWalkable
  );

  assert.equal(result.ricollocato, true);
  assert.equal(result.nuovoEdificioId, 135);
  assert.equal(result.abitanti[0]?.lavoro, "Mercante");
  assert.deepEqual(result.edifici.find((e) => e.id === 134)?.abitantiAssegnati, []);
  assert.deepEqual(result.edifici.find((e) => e.id === 135)?.abitantiAssegnati, [70]);
  assert.ok(result.pathVersoNuovo && result.pathVersoNuovo.length >= 2);
});

test("mappa tenta ricollocamento solo quando il tragitto mattutino non esiste", () => {
  const map = readFileSync("app/mappa.tsx", "utf8");
  const hook = readFileSync("src/hooks/useGameState.ts", "utf8");
  const context = readFileSync("src/context/GameContext.tsx", "utf8");

  assert.match(map, /richiesteRicollocamento/);
  assert.match(map, /ricollocaLavoroIrraggiungibileDaMappa/);
  assert.match(map, /if \(path && path\.length >= 2\)/);
  assert.match(hook, /ricollocaSeLavoroIrraggiungibile/);
  assert.match(context, /ricollocaLavoroIrraggiungibileDaMappa/);
});
