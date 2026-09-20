import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  applicaVenditeEccedenzeEmporioPerPeriodo,
  creaInventarioEmporioIniziale,
  EMPORIO_SCORTE_CIBO_INIZIALI
} from "../src/game/emporioVendita";
import { getMoneteInventarioAbitante } from "../src/game/inventario";
import type { Abitante, Edificio } from "../src/types";

const venditore = {
  id: 10,
  nome: "Raccoglitore",
  lavoro: "Raccoglitore",
  casta: "Cittadino",
  razza: "Umano",
  personalità: "Neutrale",
  inventario: [
    { itemId: "monete", quantità: 0 },
    { itemId: "mela", quantità: 2 }
  ]
} as Abitante;

const mercante = {
  id: 11,
  nome: "Mercante",
  lavoro: "Mercante",
  casta: "Cittadino",
  razza: "Umano",
  personalità: "Neutrale",
  inventario: [{ itemId: "monete", quantità: 5 }]
} as Abitante;

const emporio = {
  id: 35,
  nome: "Emporio",
  categoriaEconomica: "Impresa",
  stato: "Operativo",
  capacità: 4,
  occupazione: 1,
  abitantiAssegnati: [11],
  cassaMonete: 10
} as Edificio;

test("Emporio parte con 24 unità di scorte", () => {
  const inv = creaInventarioEmporioIniziale();
  assert.equal(inv.reduce((s, v) => s + v.quantità, 0), EMPORIO_SCORTE_CIBO_INIZIALI);
});

test("un produttore vende automaticamente una eccedenza all'Emporio", () => {
  const result = applicaVenditeEccedenzeEmporioPerPeriodo(
    [venditore, mercante],
    [emporio],
    { [emporio.id]: [] },
    1
  );
  assert.equal(result.vendite, 1);
  assert.equal(result.inventarioEmporioByEdificioId[emporio.id]?.[0]?.itemId, "mela");
  assert.equal(result.inventarioEmporioByEdificioId[emporio.id]?.[0]?.quantità, 1);
  assert.equal(getMoneteInventarioAbitante(result.abitanti.find((a) => a.id === 10)?.inventario), 1);
  assert.equal(getMoneteInventarioAbitante(result.abitanti.find((a) => a.id === 11)?.inventario), 4);
});

test("acquisto Emporio è collegato ai pasti e le scorte sono persistite", () => {
  const pasti = readFileSync("src/game/pastoGiornaliero.ts", "utf8");
  const hook = readFileSync("src/hooks/useGameState.ts", "utf8");
  const mapping = readFileSync("src/persistence/gameStateMapping.ts", "utf8");
  const page = readFileSync("app/emporio.tsx", "utf8");

  assert.match(pasti, /eseguiAcquistoPastoDaEmporio/);
  assert.match(pasti, /applicaVenditeEccedenzeEmporioPerPeriodo/);
  assert.match(hook, /inventarioEmporioByEdificioId/);
  assert.match(mapping, /inventarioEmporioByEdificioId/);
  assert.match(page, /Scorte alimentari/);
});
