import assert from "node:assert/strict";
import test from "node:test";
import { aggiungiDormitorioFootprint } from "../src/game/mappaEdificiInizialiPiazzamento";
import { DORMITORIO } from "../src/game/mappaEdificiStatici";

test("initial dormitory placement writes one 2x2 anchor and three footprint references", () => {
  const out: Record<number, any> = {};
  const vietato = new Set<number>();

  aggiungiDormitorioFootprint(7, 7, new Set(), vietato, out, 16);

  assert.deepEqual(out[16], {
    id: DORMITORIO.id,
    nome: DORMITORIO.nome,
    emoji: "",
    footprint: { w: 2, h: 2 }
  });
  assert.equal(out[17]?.footprintRef, 16);
  assert.equal(out[23]?.footprintRef, 16);
  assert.equal(out[24]?.footprintRef, 16);
  assert.equal(Object.keys(out).length, 4);
  assert.equal(vietato.has(16), true);
});

test("initial dormitory placement leaves output unchanged when no valid footprint or fallback cell exists", () => {
  const out: Record<number, any> = {};
  const vietato = new Set<number>();
  for (let i = 0; i < 49; i++) vietato.add(i);

  aggiungiDormitorioFootprint(7, 7, new Set(), vietato, out, 16);

  assert.deepEqual(out, {});
});
