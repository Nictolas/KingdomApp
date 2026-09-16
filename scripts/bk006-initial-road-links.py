from pathlib import Path

mappa_path = Path("app/mappa.tsx")
text = mappa_path.read_text(encoding="utf-8")

import_anchor = '''import {
  BAR_EDIFICIO,
  CAPANNA,
  DECORAZIONI_EMOJI,
  DORMITORIO,
  GIACIMENTO,
  RAFFINERIA_MINERARIA,
  SERRA_2_EDIFICIO,
  SERRA_EDIFICIO,
  SPAZIOPORTO_EDIFICIO,
  STRADA_OPZIONE,
  TRIBUNALE_EDIFICIO
} from "../src/game/mappaEdificiStatici";
'''
import_replacement = import_anchor + 'import { getStradeIniziali } from "../src/game/mappaStradeIniziali";\n'
if import_anchor not in text:
    raise SystemExit("mappaEdificiStatici import anchor not found")
text = text.replace(import_anchor, import_replacement, 1)

old_block = '''/** Coppie [indiceA, indiceB] per strade iniziali (anchor centro → spazioporto, serra); usa le posizioni effettive degli edifici. */
function getStradeIniziali(edificiInMappa: Record<number, EdificioInCella>): [number, number][] {
  let centro: number | null = null;
  let spazioporto: number | null = null;
  let bar: number | null = null;
  let tribunale: number | null = null;
  const serre: number[] = [];
  for (const [i, e] of Object.entries(edificiInMappa)) {
    const idx = Number(i);
    if (e.nome === "Centro di Comando" && e.footprint && !e.footprintRef) centro = idx;
    if (e.nome === "Spazioporto" && e.footprint && !e.footprintRef) spazioporto = idx;
    if (e.nome === "Serra" && e.footprint && !e.footprintRef) serre.push(idx);
    if (e.nome === "Bar" && e.footprint && !e.footprintRef) bar = idx;
    if (e.nome === "Tribunale" && e.footprint && !e.footprintRef) tribunale = idx;
  }
  const out: [number, number][] = [];
  if (centro != null && spazioporto != null) out.push([centro, spazioporto]);
  if (centro != null) {
    for (const sa of serre) out.push([centro, sa]);
  }
  if (centro != null && tribunale != null) out.push([centro, tribunale]);
  if (centro != null && bar != null) out.push([centro, bar]);
  return out;
}

'''
if old_block not in text:
    raise SystemExit("getStradeIniziali block not found")
text = text.replace(old_block, "", 1)
mappa_path.write_text(text, encoding="utf-8")

Path("src/game/mappaStradeIniziali.ts").write_text('''import type { EdificioInCellaMappa } from "./mappaTypes";

/**
 * Coppie [indiceA, indiceB] per le strade iniziali, basate sulle ancore effettive
 * degli edifici già piazzati sulla mappa.
 */
export function getStradeIniziali(
  edificiInMappa: Record<number, EdificioInCellaMappa>
): [number, number][] {
  let centro: number | null = null;
  let spazioporto: number | null = null;
  let bar: number | null = null;
  let tribunale: number | null = null;
  const serre: number[] = [];

  for (const [i, e] of Object.entries(edificiInMappa)) {
    const idx = Number(i);
    if (e.nome === "Centro di Comando" && e.footprint && !e.footprintRef) centro = idx;
    if (e.nome === "Spazioporto" && e.footprint && !e.footprintRef) spazioporto = idx;
    if (e.nome === "Serra" && e.footprint && !e.footprintRef) serre.push(idx);
    if (e.nome === "Bar" && e.footprint && !e.footprintRef) bar = idx;
    if (e.nome === "Tribunale" && e.footprint && !e.footprintRef) tribunale = idx;
  }

  const out: [number, number][] = [];
  if (centro != null && spazioporto != null) out.push([centro, spazioporto]);
  if (centro != null) {
    for (const sa of serre) out.push([centro, sa]);
  }
  if (centro != null && tribunale != null) out.push([centro, tribunale]);
  if (centro != null && bar != null) out.push([centro, bar]);
  return out;
}
''', encoding="utf-8")

Path("tests/mappa-strade-iniziali.test.ts").write_text('''import assert from "node:assert/strict";
import test from "node:test";
import { getStradeIniziali } from "../src/game/mappaStradeIniziali";
import type { EdificioInCellaMappa } from "../src/game/mappaTypes";

function edificio(
  id: number,
  nome: string,
  footprint: { w: number; h: number } | undefined,
  footprintRef?: number
): EdificioInCellaMappa {
  return { id, nome, emoji: "", footprint, footprintRef };
}

test("initial road links preserve the expected map anchors and order", () => {
  const edifici: Record<number, EdificioInCellaMappa> = {
    10: edificio(1, "Centro di Comando", { w: 3, h: 2 }),
    30: edificio(19, "Spazioporto", { w: 4, h: 3 }),
    40: edificio(2, "Serra", { w: 2, h: 1 }),
    50: edificio(21, "Serra", { w: 2, h: 1 }),
    60: edificio(12, "Tribunale", { w: 2, h: 2 }),
    70: edificio(17, "Bar", { w: 2, h: 2 })
  };

  assert.deepEqual(getStradeIniziali(edifici), [
    [10, 30],
    [10, 40],
    [10, 50],
    [10, 60],
    [10, 70]
  ]);
});

test("initial road links ignore secondary footprint cells and non-footprint fallbacks", () => {
  const edifici: Record<number, EdificioInCellaMappa> = {
    10: edificio(1, "Centro di Comando", { w: 3, h: 2 }),
    11: edificio(1, "Centro di Comando", undefined, 10),
    30: edificio(19, "Spazioporto", undefined),
    31: edificio(19, "Spazioporto", undefined, 30),
    40: edificio(2, "Serra", { w: 2, h: 1 }),
    41: edificio(2, "Serra", undefined, 40),
    60: edificio(12, "Tribunale", undefined),
    70: edificio(17, "Bar", undefined)
  };

  assert.deepEqual(getStradeIniziali(edifici), [[10, 40]]);
  assert.deepEqual(getStradeIniziali({ 40: edificio(2, "Serra", { w: 2, h: 1 }) }), []);
});
''', encoding="utf-8")
