import assert from "node:assert/strict";
import test from "node:test";
import {
  aggiungiBarFootprint,
  aggiungiDormitorioFootprint,
  aggiungiSerraFootprint,
  aggiungiSpazioportoFootprint,
  aggiungiTribunaleFootprint
} from "../src/game/mappaEdificiInizialiPiazzamento";
import {
  BAR_EDIFICIO,
  DORMITORIO,
  SERRA_EDIFICIO,
  SPAZIOPORTO_EDIFICIO,
  TRIBUNALE_EDIFICIO
} from "../src/game/mappaEdificiStatici";

function assertFootprintPlacement(
  out: Record<number, any>,
  anchor: number,
  cols: number,
  spec: { id: number; nome: string },
  w: number,
  h: number
): void {
  assert.deepEqual(out[anchor], {
    id: spec.id,
    nome: spec.nome,
    emoji: "",
    footprint: { w, h }
  });

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const index = anchor + row * cols + col;
      if (index === anchor) continue;
      assert.equal(out[index]?.footprintRef, anchor);
    }
  }
  assert.equal(Object.keys(out).length, w * h);
}

test("initial dormitory placement writes one 2x2 anchor and three footprint references", () => {
  const out: Record<number, any> = {};
  const vietato = new Set<number>();

  aggiungiDormitorioFootprint(7, 7, new Set(), vietato, out, 16);

  assertFootprintPlacement(out, 16, 7, DORMITORIO, 2, 2);
  assert.equal(vietato.has(16), true);
});

test("initial bar placement preserves the 2x2 footprint", () => {
  const out: Record<number, any> = {};
  const vietato = new Set<number>();

  aggiungiBarFootprint(8, 8, new Set(), vietato, out, 18);

  assertFootprintPlacement(out, 18, 8, BAR_EDIFICIO, 2, 2);
});

test("initial courthouse placement preserves the 2x2 footprint", () => {
  const out: Record<number, any> = {};
  const vietato = new Set<number>();

  aggiungiTribunaleFootprint(8, 8, new Set(), vietato, out, 18);

  assertFootprintPlacement(out, 18, 8, TRIBUNALE_EDIFICIO, 2, 2);
});

test("initial greenhouse placement preserves the 2x1 footprint", () => {
  const out: Record<number, any> = {};
  const vietato = new Set<number>();

  aggiungiSerraFootprint(8, 8, new Set(), vietato, out, 18, SERRA_EDIFICIO);

  assertFootprintPlacement(out, 18, 8, SERRA_EDIFICIO, 2, 1);
});

test("initial spaceport placement preserves the 4x3 footprint", () => {
  const out: Record<number, any> = {};
  const vietato = new Set<number>();

  aggiungiSpazioportoFootprint(10, 10, new Set(), vietato, out, 22);

  assertFootprintPlacement(out, 22, 10, SPAZIOPORTO_EDIFICIO, 4, 3);
});

test("initial dormitory placement leaves output unchanged when no valid footprint or fallback cell exists", () => {
  const out: Record<number, any> = {};
  const vietato = new Set<number>();
  for (let i = 0; i < 49; i++) vietato.add(i);

  aggiungiDormitorioFootprint(7, 7, new Set(), vietato, out, 16);

  assert.deepEqual(out, {});
});
