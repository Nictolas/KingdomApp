from pathlib import Path

mappa_path = Path("app/mappa.tsx")
text = mappa_path.read_text(encoding="utf-8")

import_anchor = 'import { getStradeIniziali } from "../src/game/mappaStradeIniziali";\n'
new_import = '''import {\n  calcolaAnchorCostruzione2x2,\n  costruzioneTerrenoPersistente,\n  type SelezioneCostruzioneAnteprima\n} from "../src/game/mappaCostruzioneAnteprima";\n'''
if new_import not in text:
    if import_anchor not in text:
        raise SystemExit("import anchor not found")
    text = text.replace(import_anchor, import_anchor + new_import, 1)

old_block = '''/** Anteprima piazzamento in modalità Costruisci (stessa logica di `handleScegliEdificio`). */\ntype SelezioneCostruzioneAnteprima =\n  | { tipo: "strada" }\n  | { tipo: "terreno"; kind: TerrenoCostruzioneKind }\n  | { tipo: "edificio"; edificio: Edificio };\n\n/** Strada / Acqua / Spiaggia / Erba: la modalità resta attiva fino a un secondo tap su Costruisci. */\nfunction costruzioneTerrenoPersistente(selezione: SelezioneCostruzioneAnteprima | null): boolean {\n  return selezione?.tipo === "strada" || selezione?.tipo === "terreno";\n}\n\n/** Anchor 2×2 che contiene `cellIndex` (Acqua / Spiaggia / Erba). */\nfunction calcolaAnchorCostruzione2x2(\n  cellIndex: number,\n  cols: number,\n  rows: number\n): { anchor: number | null; w: number; h: number } {\n  return calcolaAnchorStrada2x2(cellIndex, cols, rows);\n}\n\n'''
if old_block not in text:
    raise SystemExit("target block not found")
text = text.replace(old_block, "", 1)
mappa_path.write_text(text, encoding="utf-8")

module_path = Path("src/game/mappaCostruzioneAnteprima.ts")
module_path.write_text('''import type { Edificio } from "../types";\nimport type { TerrenoCostruzioneKind } from "./costruzioneSezioni";\nimport { calcolaAnchorStrada2x2 } from "./stradaFootprint";\n\n/** Anteprima piazzamento in modalità Costruisci (stessa forma usata dalla mappa). */\nexport type SelezioneCostruzioneAnteprima =\n  | { tipo: "strada" }\n  | { tipo: "terreno"; kind: TerrenoCostruzioneKind }\n  | { tipo: "edificio"; edificio: Edificio };\n\n/** Strada / Acqua / Spiaggia / Erba: la modalità resta attiva fino a un secondo tap su Costruisci. */\nexport function costruzioneTerrenoPersistente(\n  selezione: SelezioneCostruzioneAnteprima | null\n): boolean {\n  return selezione?.tipo === "strada" || selezione?.tipo === "terreno";\n}\n\n/** Anchor 2×2 che contiene `cellIndex` (Acqua / Spiaggia / Erba). */\nexport function calcolaAnchorCostruzione2x2(\n  cellIndex: number,\n  cols: number,\n  rows: number\n): { anchor: number | null; w: number; h: number } {\n  return calcolaAnchorStrada2x2(cellIndex, cols, rows);\n}\n''', encoding="utf-8")

test_path = Path("tests/mappa-costruzione-anteprima.test.ts")
test_path.write_text('''import assert from "node:assert/strict";\nimport test from "node:test";\nimport {\n  calcolaAnchorCostruzione2x2,\n  costruzioneTerrenoPersistente\n} from "../src/game/mappaCostruzioneAnteprima";\n\ntest("construction terrain mode stays active only for road and terrain selections", () => {\n  assert.equal(costruzioneTerrenoPersistente(null), false);\n  assert.equal(costruzioneTerrenoPersistente({ tipo: "strada" }), true);\n  assert.equal(costruzioneTerrenoPersistente({ tipo: "terreno", kind: "acqua" }), true);\n  assert.equal(costruzioneTerrenoPersistente({ tipo: "terreno", kind: "spiaggia" }), true);\n  assert.equal(costruzioneTerrenoPersistente({ tipo: "terreno", kind: "erba" }), true);\n  assert.equal(\n    costruzioneTerrenoPersistente({ tipo: "edificio", edificio: {} as never }),\n    false\n  );\n});\n\ntest("construction 2x2 anchor preserves the road-footprint anchor behavior", () => {\n  assert.deepEqual(calcolaAnchorCostruzione2x2(12, 5, 5), { anchor: 12, w: 2, h: 2 });\n  assert.deepEqual(calcolaAnchorCostruzione2x2(24, 5, 5), { anchor: 18, w: 2, h: 2 });\n  assert.deepEqual(calcolaAnchorCostruzione2x2(0, 1, 1), { anchor: null, w: 2, h: 2 });\n});\n''', encoding="utf-8")
