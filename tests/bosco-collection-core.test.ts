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
  competenza: 100,
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
  const atteso = raccoltoBoscoDelGiorno(raccoglitore.id, 1);
  const result = applicaRaccoltaBoscoGiornaliera(
    [{ ...raccoglitore, ultimoIngressoBoscoGiorno: 1, ultimoLavoroBosco: { giorno: 1, minuti: 360 } }], [bosco], 2, 1
  );
  const lino = result.abitanti[0]!;

  assert.equal(result.bottini.length, 1);
  assert.deepEqual(lino.ultimoRaccoltoBosco?.voci, atteso);
  assert.equal(lino.ultimoRaccoltoBosco?.giorno, 1);
  for (const voce of atteso) {
    assert.ok((lino.inventario?.find((v) => v.itemId === voce.itemId)?.quantità ?? 0) >= voce.quantità);
  }
});

test("runtime Bosco è ricollegato al cambio giorno", () => {
  const hook = readFileSync("src/hooks/useGameState.ts", "utf8");
  const engine = readFileSync("src/game/boscoRaccolta.ts", "utf8");
  assert.match(hook, /applicaRaccoltaBoscoGiornaliera/);
  assert.match(hook, /ultimoGiornoRaccoltaBoscoRef/);
  assert.match(engine, /etichettaRaccoltoBosco/);
  assert.match(engine, /trovato/);
});

test("Raccoglitore assunto che non raggiunge il Bosco: NESSUN bottino", () => {
  const result = applicaRaccoltaBoscoGiornaliera([raccoglitore], [bosco], 2, 1);
  assert.equal(result.bottini.length, 0);
  assert.equal(result.abitanti[0], raccoglitore);
});

test("Il bottino non arriva due volte e non si recupera retroattivamente", () => {
  const presente = { ...raccoglitore, ultimoIngressoBoscoGiorno: 4, ultimoLavoroBosco: { giorno: 4, minuti: 360 } };
  const prima = applicaRaccoltaBoscoGiornaliera([presente], [bosco], 5, 1);
  assert.equal(prima.bottini.length, 1);
  const doppia = applicaRaccoltaBoscoGiornaliera(prima.abitanti, [bosco], 5, 1);
  assert.equal(doppia.bottini.length, 0);
  const giorniSuccessivi = applicaRaccoltaBoscoGiornaliera(prima.abitanti, [bosco], 7, 2);
  assert.equal(giorniSuccessivi.bottini.length, 0);
});

test("Ingresso senza lavoro: nessun raccolto, anche se l'abitante arriva davvero", () => {
  for (const minuti of [0, 1, 29]) {
    const persona = {
      ...raccoglitore,
      ultimoIngressoBoscoGiorno: 8,
      ultimoLavoroBosco: { giorno: 8, minuti }
    };
    const risultato = applicaRaccoltaBoscoGiornaliera([persona], [bosco], 9, 1);
    assert.equal(risultato.bottini.length, 0);
    assert.equal(risultato.abitanti[0], persona);
  }
  const arrivoNonTracciato = { ...raccoglitore, ultimoIngressoBoscoGiorno: 8 };
  assert.equal(applicaRaccoltaBoscoGiornaliera([arrivoNonTracciato], [bosco], 9, 1).bottini.length, 0);
});

test("Il tempo lavorato deve appartenere allo stesso giorno del viaggio reale", () => {
  const persona = {
    ...raccoglitore,
    ultimoIngressoBoscoGiorno: 8,
    ultimoLavoroBosco: { giorno: 7, minuti: 400 }
  };
  assert.equal(applicaRaccoltaBoscoGiornaliera([persona], [bosco], 9, 1).bottini.length, 0);
});

test("Il risultato della raccolta è stabile quando si ricarica il salvataggio", () => {
  const residente = {
    ...raccoglitore,
    ultimoIngressoBoscoGiorno: 1,
    ultimoLavoroBosco: { giorno: 1, minuti: 360 }
  };
  const a = applicaRaccoltaBoscoGiornaliera([residente], [bosco], 2, 1);
  const b = applicaRaccoltaBoscoGiornaliera([residente], [bosco], 2, 1);
  assert.deepEqual(a.bottini, b.bottini);
  assert.deepEqual(a.abitanti, b.abitanti);
});
