import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  aggiungiIncassoImpresa,
  getCassaImpresa,
  provaPagaDaCassa
} from "../src/game/impresaCassa";
import type { Edificio } from "../src/types";

const emporio = {
  id: 35,
  nome: "Emporio",
  categoriaEconomica: "Impresa",
  stato: "Operativo",
  capacità: 4,
  occupazione: 0,
  abitantiAssegnati: [],
  cassaMonete: 10
} as unknown as Edificio;

test("cassa Impresa incassa e paga senza andare sotto zero", () => {
  const incasso = aggiungiIncassoImpresa(emporio, 5);
  assert.equal(getCassaImpresa(incasso), 15);
  const pagamento = provaPagaDaCassa(incasso, 20);
  assert.equal(pagamento.pagato, 15);
  assert.equal(getCassaImpresa(pagamento.edificio), 0);
});

test("Emporio è collegato al payroll privato e alla mappa", () => {
  const hook = readFileSync("src/hooks/useGameState.ts", "utf8");
  const page = readFileSync("app/emporio.tsx", "utf8");
  const routes = readFileSync("src/game/mappaEdificioRoutes.ts", "utf8");

  assert.match(hook, /pagaStipendiImpresaGiornalieri/);
  assert.match(page, /Cassa Impresa/);
  assert.match(page, /Mercanti/);
  assert.match(routes, /"Emporio": "\/emporio"/);
});
