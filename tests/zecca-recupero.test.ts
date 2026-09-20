import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  applicaZeccaGiornaliera,
  stimaConioMensileZecca
} from "../src/game/zeccaProduzione";
import type { Edificio, Risorsa } from "../src/types";

const zecca = {
  id: 52,
  nome: "Zecca",
  tipo: "Amministrazione",
  stato: "Operativo",
  efficienza: 90,
  capacità: 8,
  occupazione: 1,
  abitantiAssegnati: [10]
} as Edificio;

const risorse = [{ nome: "Metalli", quantità: 10 }] as Risorsa[];

test("la Zecca converte Metalli in monete", () => {
  const result = applicaZeccaGiornaliera(risorse, [zecca], 100, 1);
  assert.equal(result.moneteConiate, 6);
  assert.equal(result.moneteGiocatore, 106);
  assert.equal(result.risorse.find((r) => r.nome === "Metalli")?.quantità, 8);
});

test("la stima mensile rispetta i Metalli disponibili", () => {
  assert.equal(stimaConioMensileZecca([zecca], risorse), 30);
});

test("Zecca è collegata a gameplay, schermata e mappa", () => {
  const hook = readFileSync("src/hooks/useGameState.ts", "utf8");
  const page = readFileSync("app/zecca.tsx", "utf8");
  const routes = readFileSync("src/game/mappaEdificioRoutes.ts", "utf8");

  assert.match(hook, /applicaZeccaGiornaliera/);
  assert.match(hook, /La Zecca ha coniato/);
  assert.match(page, /Stima Tesoro/);
  assert.match(page, /Monetieri/);
  assert.match(routes, /"Zecca": "\/zecca"/);
});
