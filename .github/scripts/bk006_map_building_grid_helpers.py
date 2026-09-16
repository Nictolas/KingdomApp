from pathlib import Path

mappa = Path("app/mappa.tsx")
text = mappa.read_text()

old_import = '''import {
  dimensioniFootprintEdificioInMappa,
  indiciFootprintProtettiIniziali
} from "../src/game/mappaEdificioFootprints";'''
new_import = '''import {
  dimensioniFootprintEdificioInMappa,
  giacimentoIndicesDaEdifici,
  indiciFootprintProtettiIniziali,
  rimuoviFootprintEdificioDaMappa
} from "../src/game/mappaEdificioFootprints";'''
assert text.count(old_import) == 1
text = text.replace(old_import, new_import)

old_giacimenti = '''function giacimentoIndicesDaEdifici(edificiInMappa: Record<number, EdificioInCella>): Set<number> {
  return new Set(
    Object.keys(edificiInMappa)
      .map(Number)
      .filter((i) => edificiInMappa[i]?.nome === "Giacimento")
  );
}

'''
assert text.count(old_giacimenti) == 1
text = text.replace(old_giacimenti, "")

old_remove = '''function rimuoviFootprintEdificioDaMappa(
  out: Record<number, EdificioInCella>,
  anchor: number,
  w: number,
  h: number,
  cols: number
): void {
  for (const i of getIndiciFootprint(anchor, w, h, cols)) {
    delete out[i];
  }
}

'''
assert text.count(old_remove) == 1
text = text.replace(old_remove, "")
mappa.write_text(text)

module = Path("src/game/mappaEdificioFootprints.ts")
mod = module.read_text()
marker = "/** Celle occupate dagli edifici iniziali e quindi protette dalla demolizione. */"
addition = '''/** Indici delle celle che contengono giacimenti. */
export function giacimentoIndicesDaEdifici(
  edificiInMappa: Record<number, { nome: string }>
): Set<number> {
  return new Set(
    Object.keys(edificiInMappa)
      .map(Number)
      .filter((i) => edificiInMappa[i]?.nome === "Giacimento")
  );
}

/** Rimuove tutte le celle appartenenti a un footprint rettangolare. */
export function rimuoviFootprintEdificioDaMappa<T>(
  out: Record<number, T>,
  anchor: number,
  w: number,
  h: number,
  cols: number
): void {
  for (const i of getIndiciFootprint(anchor, w, h, cols)) {
    delete out[i];
  }
}

'''
assert mod.count(marker) == 1
mod = mod.replace(marker, addition + marker)
module.write_text(mod)

test_file = Path("tests/mappa-edificio-footprints.test.ts")
t = test_file.read_text()
old_test_import = '''import {
  dimensioniFootprintEdificioInMappa,
  indiciFootprintProtettiIniziali,
  type MappaEdificioFootprintEntry
} from "../src/game/mappaEdificioFootprints.ts";'''
new_test_import = '''import {
  dimensioniFootprintEdificioInMappa,
  giacimentoIndicesDaEdifici,
  indiciFootprintProtettiIniziali,
  rimuoviFootprintEdificioDaMappa,
  type MappaEdificioFootprintEntry
} from "../src/game/mappaEdificioFootprints.ts";'''
assert t.count(old_test_import) == 1
t = t.replace(old_test_import, new_test_import)
t += '''

test("giacimentoIndicesDaEdifici restituisce solo le celle Giacimento", () => {
  const edifici = {
    3: { nome: "Giacimento" },
    5: { nome: "Serra" },
    9: { nome: "Giacimento" }
  };
  assert.deepEqual([...giacimentoIndicesDaEdifici(edifici)].sort((a, b) => a - b), [3, 9]);
});

test("rimuoviFootprintEdificioDaMappa elimina solo il rettangolo richiesto", () => {
  const edifici: Record<number, string> = {
    6: "a",
    7: "b",
    11: "c",
    12: "d",
    20: "keep"
  };
  rimuoviFootprintEdificioDaMappa(edifici, 6, 2, 2, 5);
  assert.deepEqual(edifici, { 20: "keep" });
});
'''
test_file.write_text(t)
