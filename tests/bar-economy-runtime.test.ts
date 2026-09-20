import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  COSTO_BAR_MONETE,
  pagaIngressoBar,
  provaAssumiPrimoArrivoComeBaristaSeVuoto,
  raggruppaBaristiInServizioPerBar
} from "../src/game/barEconomia";
import { pagaFissoEDistribuisciTipBar } from "../src/game/impresaCassa";
import { getMoneteInventarioAbitante } from "../src/game/inventario";
import type { Abitante, Edificio } from "../src/types";

const bar = {
  id: 17,
  nome: "Bar",
  stato: "Operativo",
  categoriaEconomica: "Impresa",
  capacità: 20,
  occupazione: 0,
  abitantiAssegnati: [],
  stipendioPerLavoratore: 30,
  cassaMonete: 10
} as Edificio;

const cliente = {
  id: 5,
  nome: "Milo",
  lavoro: "Disoccupato",
  casta: "Cittadino",
  razza: "Umano",
  personalità: "Neutrale",
  inventario: [{ itemId: "monete", quantità: 5 }]
} as Abitante;

test("cliente paga il prezzo corrente della Birra", () => {
  assert.equal(COSTO_BAR_MONETE, 2);
  const dopo = pagaIngressoBar(cliente);
  assert.ok(dopo);
  assert.equal(getMoneteInventarioAbitante(dopo?.inventario), 3);
});

test("primo entrante idoneo diventa Barista se il Bar è vuoto", () => {
  const result = provaAssumiPrimoArrivoComeBaristaSeVuoto([cliente], [bar], 5, 17);
  assert.equal(result.assunto, true);
  assert.equal(result.abitanti[0]?.lavoro, "Barista");
  assert.deepEqual(result.edifici[0]?.abitantiAssegnati, [5]);
});

test("a fine turno il Bar paga fisso e distribuisce la cassa residua", () => {
  let abitanti = [
    { ...cliente, id: 7, nome: "A", lavoro: "Barista", inventario: [{ itemId: "monete", quantità: 0 }] },
    { ...cliente, id: 8, nome: "B", lavoro: "Barista", inventario: [{ itemId: "monete", quantità: 0 }] }
  ] as Abitante[];
  const barConDue = { ...bar, abitantiAssegnati: [7, 8], occupazione: 2, cassaMonete: 10 };

  const gruppi = raggruppaBaristiInServizioPerBar([7, 8], [barConDue]);
  const edifici = pagaFissoEDistribuisciTipBar([barConDue], gruppi, (id, fn) => {
    abitanti = abitanti.map((a) => (a.id === id ? fn(a) : a));
  });

  assert.equal(getMoneteInventarioAbitante(abitanti[0]?.inventario), 5);
  assert.equal(getMoneteInventarioAbitante(abitanti[1]?.inventario), 5);
  assert.equal(edifici[0]?.cassaMonete, 0);
});

test("mappa e schermata Bar usano cassa privata e Registrazioni", () => {
  const map = readFileSync("app/mappa.tsx", "utf8");
  const hook = readFileSync("src/hooks/useGameState.ts", "utf8");
  const context = readFileSync("src/context/GameContext.tsx", "utf8");
  const page = readFileSync("app/bar/[id].tsx", "utf8");

  assert.match(map, /provaAssumiBaristaBarVuotoDaMappa/);
  assert.match(map, /incassaImpresa\(barEdificioId, COSTO_BAR_MONETE\)/);
  assert.match(map, /ITEM_BIRRA_BAR/);
  assert.match(map, /registraScambioCommerciale/);
  assert.match(map, /applicaPagaETipBarFineTurno/);
  assert.doesNotMatch(map, /accreditaMoneteGiocatore\(spesaBar\)/);
  assert.match(hook, /pagaFissoEDistribuisciTipBar/);
  assert.match(context, /incassaImpresa/);
  assert.match(page, /Cassa:/);
  assert.match(page, /Fatturato mese:/);
});
