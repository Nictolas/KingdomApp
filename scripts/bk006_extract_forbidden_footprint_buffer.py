from pathlib import Path

app_path = Path("app/mappa.tsx")
app = app_path.read_text(encoding="utf-8")

import_marker = '''} from "../src/game/mappaCostruzioneAnteprima";\n'''
new_import = '''import { estendiVietatoConFootprintECuscino } from "../src/game/mappaPiazzamentoFootprint";\n'''
if new_import not in app:
    if import_marker not in app:
        raise SystemExit("import marker not found")
    app = app.replace(import_marker, import_marker + new_import, 1)

old_function = '''function estendiVietatoConFootprintECuscino(\n  anchor: number,\n  w: number,\n  h: number,\n  cols: number,\n  rows: number,\n  vietato: Set<number>\n): void {\n  for (const i of getIndiciFootprint(anchor, w, h, cols)) vietato.add(i);\n  for (const i of getIndiciCuscinoErba(anchor, w, h, cols, rows)) vietato.add(i);\n}\n\n'''
if old_function not in app:
    raise SystemExit("target function not found")
app = app.replace(old_function, "", 1)
app_path.write_text(app, encoding="utf-8")

module_path = Path("src/game/mappaPiazzamentoFootprint.ts")
if module_path.exists():
    raise SystemExit(f"{module_path} already exists")
module_path.write_text('''import { getIndiciCuscinoErba, getIndiciFootprint } from "./mappaGeometry";\n\n/** Aggiunge a `vietato` il footprint e il cuscino di una cella che lo circonda. */\nexport function estendiVietatoConFootprintECuscino(\n  anchor: number,\n  w: number,\n  h: number,\n  cols: number,\n  rows: number,\n  vietato: Set<number>\n): void {\n  for (const i of getIndiciFootprint(anchor, w, h, cols)) vietato.add(i);\n  for (const i of getIndiciCuscinoErba(anchor, w, h, cols, rows)) vietato.add(i);\n}\n''', encoding="utf-8")

test_path = Path("tests/mappa-piazzamento-footprint.test.ts")
if test_path.exists():
    raise SystemExit(f"{test_path} already exists")
test_path.write_text('''import assert from "node:assert/strict";\nimport test from "node:test";\n\nimport {\n  estendiVietatoConFootprintECuscino\n} from "../src/game/mappaPiazzamentoFootprint.ts";\n\ntest("estendiVietatoConFootprintECuscino aggiunge footprint e anello circostante", () => {\n  const vietato = new Set<number>([24]);\n  estendiVietatoConFootprintECuscino(6, 2, 2, 5, 5, vietato);\n\n  assert.deepEqual(\n    [...vietato].sort((a, b) => a - b),\n    [0, 1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13, 15, 16, 17, 18, 24]\n  );\n});\n\ntest("estendiVietatoConFootprintECuscino ritaglia il cuscino ai bordi della mappa", () => {\n  const vietato = new Set<number>();\n  estendiVietatoConFootprintECuscino(0, 2, 1, 4, 3, vietato);\n\n  assert.deepEqual([...vietato].sort((a, b) => a - b), [0, 1, 2, 4, 5, 6]);\n});\n\ntest("estendiVietatoConFootprintECuscino è idempotente su un Set", () => {\n  const vietato = new Set<number>();\n  estendiVietatoConFootprintECuscino(5, 1, 1, 4, 4, vietato);\n  const prima = [...vietato].sort((a, b) => a - b);\n\n  estendiVietatoConFootprintECuscino(5, 1, 1, 4, 4, vietato);\n  assert.deepEqual([...vietato].sort((a, b) => a - b), prima);\n});\n''', encoding="utf-8")
