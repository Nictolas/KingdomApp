import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  BOTTINO_BOSCO,
  applicaRaccoltaBoscoGiornaliera,
  raccoltoBoscoDelGiorno
} from "../src/game/boscoRaccolta";
import {
  OGGETTI_INVENTARIO,
  normalizzaInventarioAbitante
} from "../src/game/inventario";
import type { Abitante, Edificio } from "../src/types";

const raccoglitore = {
  id: 17,
  nome: "Lino",
  lavoro: "Raccoglitore",
  casta: "Cittadino",
  razza: "Umano",
  personalità: "Neutrale",
  inventario: [
    { itemId: "monete", quantità: 5 },
    { itemId: "mela", quantità: 1 }
  ]
} as Abitante;

const bosco = {
  id: 51,
  nome: "Bosco",
  stato: "Operativo",
  capacità: 20,
  occupazione: 1,
  abitantiAssegnati: [17]
} as Edificio;

test("tutti i bottini Bosco sono oggetti inventario validi", () => {
  for (const drop of BOTTINO_BOSCO) {
    assert.ok(OGGETTI_INVENTARIO[drop.itemId], drop.itemId);
  }
});

test("normalizzazione inventario conserva materiali raccolti", () => {
  const inv = normalizzaInventarioAbitante([
    ...(raccoglitore.inventario ?? []),
    { itemId: "legno", quantità: 3 }
  ]);
  assert.equal(inv.find((v) => v.itemId === "legno")?.quantità, 3);
});

test("Raccoglitore riceve il bottino giornaliero e registra ultimo raccolto", () => {
  const atteso = raccoltoBoscoDelGiorno(raccoglitore.id, 2).map(v => ({ ...v, quantità: v.quantità * 6 }));
  const result = applicaRaccoltaBoscoGiornaliera([raccoglitore], [bosco], 2, 1);
  const lino = result.abitanti[0]!;

  assert.equal(result.bottini.length, 1);
  assert.deepEqual(lino.ultimoRaccoltoBosco?.voci, atteso);
  assert.equal(lino.ultimoRaccoltoBosco?.giorno, 2);
  for (const voce of atteso) {
    assert.ok((lino.inventario?.find((v) => v.itemId === voce.itemId)?.quantità ?? 0) >= voce.quantità);
  }
});

test("runtime Bosco è ricollegato al cambio giorno", () => {
  const hook = readFileSync("src/hooks/useGameState.ts", "utf8");
  const engine = readFileSync("src/game/boscoRaccolta.ts", "utf8");
  assert.match(hook, /applicaRaccoltaBoscoGiornaliera/);
  assert.match(hook, /ultimoGiornoRaccoltaBoscoRef/);
  assert.match(engine, /ha trovato/);
});
