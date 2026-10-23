import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { prelevaTassaImpresaMensile } from "../src/game/impresaCassa";
import type { Edificio } from "../src/types";

const impresa = {
  id: 35,
  nome: "Emporio",
  categoriaEconomica: "Impresa",
  stato: "Operativo",
  capacità: 4,
  occupazione: 0,
  abitantiAssegnati: [],
  cassaMonete: 50,
  fatturatoMeseMonete: 100
} as unknown as Edificio;

test("tassa imprese preleva il 10% del fatturato dalla cassa e accredita il Tesoro", () => {
  const result = prelevaTassaImpresaMensile([impresa], 200);
  assert.equal(result.gettito, 10);
  assert.equal(result.moneteGiocatore, 210);
  assert.equal(result.edifici[0]?.cassaMonete, 40);
  assert.equal(result.edifici[0]?.fatturatoMeseMonete, 0);
});

test("se la cassa non basta, versa solo il disponibile ma azzera il fatturato mensile", () => {
  const result = prelevaTassaImpresaMensile(
    [{ ...impresa, cassaMonete: 3, fatturatoMeseMonete: 100 }],
    200
  );
  assert.equal(result.gettito, 3);
  assert.equal(result.moneteGiocatore, 203);
  assert.equal(result.edifici[0]?.cassaMonete, 0);
  assert.equal(result.edifici[0]?.fatturatoMeseMonete, 0);
});

test("Bosco e Miniera non pagano la tassa impresa", () => {
  const result = prelevaTassaImpresaMensile(
    [
      { ...impresa, id: 51, nome: "Bosco", cassaMonete: 20, fatturatoMeseMonete: 100 },
      { ...impresa, id: 50, nome: "Miniera", cassaMonete: 20, fatturatoMeseMonete: 100 }
    ],
    200
  );
  assert.equal(result.gettito, 0);
  assert.equal(result.moneteGiocatore, 200);
  assert.equal(result.edifici[0]?.fatturatoMeseMonete, 100);
  assert.equal(result.edifici[1]?.fatturatoMeseMonete, 100);
});

test("cambio mese collega la tassa imprese prima degli effetti di disordine", () => {
  const hook = readFileSync("src/hooks/useGameState.ts", "utf8");
  assert.match(hook, /prelevaTassaImpresaMensile/);
  assert.match(hook, /tasseImprese\.moneteGiocatore/);
  assert.match(hook, /tasseImprese\.edifici/);
  assert.match(hook, /Tassa imprese:/);
});
