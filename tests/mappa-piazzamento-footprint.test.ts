import assert from "node:assert/strict";
import test from "node:test";

import {
  estendiVietatoConFootprintECuscino,
  puòPiazzareFootprintConCuscino,
  trovaAnchorFootprintLibero,
  trovaCellaSingolaConCuscino
} from "../src/game/mappaPiazzamentoFootprint.ts";

test("puòPiazzareFootprintConCuscino accetta un footprint interno con cuscino libero", () => {
  assert.equal(
    puòPiazzareFootprintConCuscino(14, 2, 2, 6, 6, new Set<number>(), new Set<number>()),
    true
  );
});

test("puòPiazzareFootprintConCuscino rifiuta un footprint che esce dalla griglia", () => {
  assert.equal(
    puòPiazzareFootprintConCuscino(16, 2, 2, 5, 5, new Set<number>(), new Set<number>()),
    false
  );
});

test("puòPiazzareFootprintConCuscino rifiuta footprint su acqua, fiume o cella vietata", () => {
  assert.equal(
    puòPiazzareFootprintConCuscino(1, 1, 1, 5, 5, new Set<number>(), new Set<number>()),
    false
  );
  assert.equal(
    puòPiazzareFootprintConCuscino(12, 1, 1, 5, 5, new Set<number>([12]), new Set<number>()),
    false
  );
  assert.equal(
    puòPiazzareFootprintConCuscino(12, 1, 1, 5, 5, new Set<number>(), new Set<number>([12])),
    false
  );
});

test("puòPiazzareFootprintConCuscino rifiuta un cuscino occupato o non solo-erba", () => {
  assert.equal(
    puòPiazzareFootprintConCuscino(12, 1, 1, 5, 5, new Set<number>(), new Set<number>([11])),
    false
  );
  assert.equal(
    puòPiazzareFootprintConCuscino(12, 1, 1, 5, 5, new Set<number>([6]), new Set<number>()),
    false
  );
});

test("trovaAnchorFootprintLibero mantiene preferred quando è già valido", () => {
  assert.equal(
    trovaAnchorFootprintLibero(2, 2, 27, 8, 8, new Set<number>(), new Set<number>()),
    27
  );
});

test("trovaAnchorFootprintLibero sceglie il candidato valido più vicino", () => {
  assert.equal(
    trovaAnchorFootprintLibero(2, 2, 0, 8, 8, new Set<number>(), new Set<number>()),
    18
  );
});

test("trovaAnchorFootprintLibero restituisce null quando ogni cella è vietata", () => {
  const vietato = new Set<number>(Array.from({ length: 64 }, (_, i) => i));
  assert.equal(trovaAnchorFootprintLibero(1, 1, 27, 8, 8, new Set<number>(), vietato), null);
});

test("trovaCellaSingolaConCuscino usa la stessa ricerca del footprint 1x1", () => {
  const riverSet = new Set<number>();
  const vietato = new Set<number>();
  assert.equal(trovaCellaSingolaConCuscino(27, 8, 8, riverSet, vietato), 27);
  assert.equal(
    trovaCellaSingolaConCuscino(27, 8, 8, riverSet, vietato),
    trovaAnchorFootprintLibero(1, 1, 27, 8, 8, riverSet, vietato)
  );
});

test("estendiVietatoConFootprintECuscino aggiunge footprint e anello circostante", () => {
  const vietato = new Set<number>([24]);
  estendiVietatoConFootprintECuscino(6, 2, 2, 5, 5, vietato);

  assert.deepEqual(
    [...vietato].sort((a, b) => a - b),
    [0, 1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13, 15, 16, 17, 18, 24]
  );
});

test("estendiVietatoConFootprintECuscino ritaglia il cuscino ai bordi della mappa", () => {
  const vietato = new Set<number>();
  estendiVietatoConFootprintECuscino(0, 2, 1, 4, 3, vietato);

  assert.deepEqual([...vietato].sort((a, b) => a - b), [0, 1, 2, 4, 5, 6]);
});

test("estendiVietatoConFootprintECuscino è idempotente su un Set", () => {
  const vietato = new Set<number>();
  estendiVietatoConFootprintECuscino(5, 1, 1, 4, 4, vietato);
  const prima = [...vietato].sort((a, b) => a - b);

  estendiVietatoConFootprintECuscino(5, 1, 1, 4, 4, vietato);
  assert.deepEqual([...vietato].sort((a, b) => a - b), prima);
});
