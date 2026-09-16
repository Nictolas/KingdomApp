from pathlib import Path

app_path = Path("app/mappa.tsx")
app = app_path.read_text(encoding="utf-8")

old_import = '''import {
  expandAxisToUnitSteps,
  getIndiciCuscinoErba,
  getIndiciFootprint,
  getManhattanPathSegments,
  getVicini8,
  isAcqua,
  riverSetDaTerreno
} from "../src/game/mappaGeometry";'''
new_import = '''import {
  cellaSoloErba,
  expandAxisToUnitSteps,
  getIndiciCuscinoErba,
  getIndiciFootprint,
  getManhattanPathSegments,
  getVicini8,
  haVicinoFiume,
  isAcqua,
  riverSetDaTerreno
} from "../src/game/mappaGeometry";'''
if old_import not in app:
    raise SystemExit("Expected mappaGeometry import block not found")
app = app.replace(old_import, new_import, 1)

old_helpers = '''function haVicinoFiume(index: number, riverSet: Set<number>, cols: number, rows: number): boolean {
  return getVicini8(index, cols, rows).some((n) => riverSet.has(n));
}

/** Cella adatta a “solo erba”: no mare, no fiume; se adiacente a un fiume diventerebbe sabbia → esclusa. */
function cellaSoloErba(index: number, cols: number, rows: number, riverSet: Set<number>): boolean {
  if (isAcqua(index, cols, rows) || riverSet.has(index)) return false;
  if (haVicinoFiume(index, riverSet, cols, rows)) return false;
  return true;
}

'''
if old_helpers not in app:
    raise SystemExit("Expected river-neighbor helper block not found")
app = app.replace(old_helpers, "", 1)
app_path.write_text(app, encoding="utf-8")

geometry_path = Path("src/game/mappaGeometry.ts")
geometry = geometry_path.read_text(encoding="utf-8")
marker = '''export function riverSetDaTerreno(terreno: Record<number, TerrenoType>): Set<number> {
  const out = new Set<number>();
  for (const [key, value] of Object.entries(terreno)) {
    if (value === "river") out.add(Number(key));
  }
  return out;
}
'''
addition = marker + '''\n/** True when any of the eight neighboring cells is a river cell. */
export function haVicinoFiume(index: number, riverSet: Set<number>, cols: number, rows: number): boolean {
  return getVicini8(index, cols, rows).some((n) => riverSet.has(n));
}

/** Cell suitable for grass-only placement: not border water, not river, and not next to a river. */
export function cellaSoloErba(index: number, cols: number, rows: number, riverSet: Set<number>): boolean {
  if (isAcqua(index, cols, rows) || riverSet.has(index)) return false;
  if (haVicinoFiume(index, riverSet, cols, rows)) return false;
  return true;
}
'''
if marker not in geometry:
    raise SystemExit("Expected riverSetDaTerreno marker not found")
geometry = geometry.replace(marker, addition, 1)
geometry_path.write_text(geometry, encoding="utf-8")

test_path = Path("tests/mappa-geometry.test.ts")
test = test_path.read_text(encoding="utf-8")
old_test_import = '''import {
  expandAxisToUnitSteps,
  getIndiciCuscinoErba,
  getIndiciFootprint,
  getManhattanPathSegments,
  getVicini8,
  isAcqua,
  riverSetDaTerreno
} from "../src/game/mappaGeometry.ts";'''
new_test_import = '''import {
  cellaSoloErba,
  expandAxisToUnitSteps,
  getIndiciCuscinoErba,
  getIndiciFootprint,
  getManhattanPathSegments,
  getVicini8,
  haVicinoFiume,
  isAcqua,
  riverSetDaTerreno
} from "../src/game/mappaGeometry.ts";'''
if old_test_import not in test:
    raise SystemExit("Expected geometry test import block not found")
test = test.replace(old_test_import, new_test_import, 1)

test_marker = '''test("riverSetDaTerreno raccoglie solo le celle river", () => {
  assert.deepEqual(
    [...riverSetDaTerreno({ 0: "erba", 1: "river", 2: "sabbia", 8: "river" })],
    [1, 8]
  );
  assert.deepEqual([...riverSetDaTerreno({ 0: "erba", 4: "sabbia" })], []);
});
'''
new_tests = test_marker + '''\ntest("haVicinoFiume usa gli otto vicini e rispetta i bordi", () => {
  assert.equal(haVicinoFiume(12, new Set([6]), 5, 5), true);
  assert.equal(haVicinoFiume(12, new Set([0]), 5, 5), false);
  assert.equal(haVicinoFiume(0, new Set([6]), 5, 5), true);
});

test("cellaSoloErba esclude bordo, fiume e celle adiacenti al fiume", () => {
  assert.equal(cellaSoloErba(0, 5, 5, new Set()), false);
  assert.equal(cellaSoloErba(12, 5, 5, new Set([12])), false);
  assert.equal(cellaSoloErba(13, 5, 5, new Set([12])), false);
  assert.equal(cellaSoloErba(18, 5, 5, new Set([6])), true);
});
'''
if test_marker not in test:
    raise SystemExit("Expected riverSetDaTerreno test marker not found")
test = test.replace(test_marker, new_tests, 1)
test_path.write_text(test, encoding="utf-8")
