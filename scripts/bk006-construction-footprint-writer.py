from pathlib import Path

mappa = Path('app/mappa.tsx')
text = mappa.read_text(encoding='utf-8')

old_import = '''import {\n  dimensioniFootprintEdificioInMappa,\n  giacimentoIndicesDaEdifici,\n  indiciFootprintProtettiIniziali,\n  rimuoviFootprintEdificioDaMappa\n} from "../src/game/mappaEdificioFootprints";'''
new_import = '''import {\n  applicaEdificioFootprintCostruzione,\n  dimensioniFootprintEdificioInMappa,\n  giacimentoIndicesDaEdifici,\n  indiciFootprintProtettiIniziali,\n  rimuoviFootprintEdificioDaMappa\n} from "../src/game/mappaEdificioFootprints";'''
if old_import not in text:
    raise SystemExit('expected mappaEdificioFootprints import not found')
text = text.replace(old_import, new_import, 1)

old_fn = '''/** Scrive l'occupazione multi-cella sulla griglia (come aggiungiSerraFootprint ma con anchor già scelto). */\nfunction applicaEdificioFootprintCostruzione(\n  out: Record<number, EdificioInCella>,\n  anchor: number,\n  w: number,\n  h: number,\n  cols: number,\n  base: { id: number; nome: string; emoji: string; edificioGlobaleId?: number }\n): void {\n  const celle = getIndiciFootprint(anchor, w, h, cols);\n  if (w === 1 && h === 1) {\n    out[anchor] = {\n      id: base.id,\n      nome: base.nome,\n      emoji: base.emoji,\n      edificioGlobaleId: base.edificioGlobaleId\n    };\n    return;\n  }\n  out[anchor] = {\n    id: base.id,\n    nome: base.nome,\n    emoji: "",\n    footprint: { w, h },\n    edificioGlobaleId: base.edificioGlobaleId\n  };\n  for (const i of celle) {\n    if (i === anchor) continue;\n    out[i] = {\n      id: base.id,\n      nome: base.nome,\n      emoji: "",\n      footprintRef: anchor,\n      edificioGlobaleId: base.edificioGlobaleId\n    };\n  }\n}\n\n'''
if old_fn not in text:
    raise SystemExit('expected local construction footprint writer not found')
text = text.replace(old_fn, '', 1)
mappa.write_text(text, encoding='utf-8')

module = Path('src/game/mappaEdificioFootprints.ts')
mod = module.read_text(encoding='utf-8')
if 'import type { EdificioInCellaMappa } from "./mappaTypes";' not in mod:
    mod = mod.replace('import { getIndiciFootprint } from "./mappaGeometry";\n', 'import { getIndiciFootprint } from "./mappaGeometry";\nimport type { EdificioInCellaMappa } from "./mappaTypes";\n')
insert_after = '''export type MappaEdificioFootprintEntry = {\n  nome: string;\n  footprintRef?: number;\n  footprint?: MappaCostruzioneFootprint;\n};\n'''
new_fn = '''\n/** Scrive un edificio 1×1 o multi-cella sulla griglia a partire da un anchor già scelto. */\nexport function applicaEdificioFootprintCostruzione(\n  out: Record<number, EdificioInCellaMappa>,\n  anchor: number,\n  w: number,\n  h: number,\n  cols: number,\n  base: { id: number; nome: string; emoji: string; edificioGlobaleId?: number }\n): void {\n  const celle = getIndiciFootprint(anchor, w, h, cols);\n  if (w === 1 && h === 1) {\n    out[anchor] = {\n      id: base.id,\n      nome: base.nome,\n      emoji: base.emoji,\n      edificioGlobaleId: base.edificioGlobaleId\n    };\n    return;\n  }\n  out[anchor] = {\n    id: base.id,\n    nome: base.nome,\n    emoji: "",\n    footprint: { w, h },\n    edificioGlobaleId: base.edificioGlobaleId\n  };\n  for (const i of celle) {\n    if (i === anchor) continue;\n    out[i] = {\n      id: base.id,\n      nome: base.nome,\n      emoji: "",\n      footprintRef: anchor,\n      edificioGlobaleId: base.edificioGlobaleId\n    };\n  }\n}\n'''
if 'export function applicaEdificioFootprintCostruzione' in mod:
    raise SystemExit('writer already exists in module')
if insert_after not in mod:
    raise SystemExit('module insertion point not found')
mod = mod.replace(insert_after, insert_after + new_fn, 1)
module.write_text(mod, encoding='utf-8')

test = Path('tests/mappa-edificio-footprints.test.ts')
t = test.read_text(encoding='utf-8')
t = t.replace('import {\n  dimensioniFootprintEdificioInMappa,', 'import {\n  applicaEdificioFootprintCostruzione,\n  dimensioniFootprintEdificioInMappa,', 1)
if 'import type { EdificioInCellaMappa } from "../src/game/mappaTypes.ts";' not in t:
    t = t.replace('} from "../src/game/mappaEdificioFootprints.ts";\n', '} from "../src/game/mappaEdificioFootprints.ts";\nimport type { EdificioInCellaMappa } from "../src/game/mappaTypes.ts";\n', 1)
if 'applicaEdificioFootprintCostruzione scrive correttamente 1x1 e multi-cella' in t:
    raise SystemExit('test already added')
t += '''\n\ntest("applicaEdificioFootprintCostruzione scrive correttamente 1x1 e multi-cella", () => {\n  const edifici: Record<number, EdificioInCellaMappa> = {};\n\n  applicaEdificioFootprintCostruzione(edifici, 3, 1, 1, 5, {\n    id: 99,\n    nome: "Singolo",\n    emoji: "🧱",\n    edificioGlobaleId: 700\n  });\n  assert.deepEqual(edifici[3], {\n    id: 99,\n    nome: "Singolo",\n    emoji: "🧱",\n    edificioGlobaleId: 700\n  });\n\n  applicaEdificioFootprintCostruzione(edifici, 6, 2, 2, 5, {\n    id: 12,\n    nome: "Tribunale",\n    emoji: "⚖️",\n    edificioGlobaleId: 701\n  });\n  assert.deepEqual(edifici[6], {\n    id: 12,\n    nome: "Tribunale",\n    emoji: "",\n    footprint: { w: 2, h: 2 },\n    edificioGlobaleId: 701\n  });\n  for (const i of [7, 11, 12]) {\n    assert.deepEqual(edifici[i], {\n      id: 12,\n      nome: "Tribunale",\n      emoji: "",\n      footprintRef: 6,\n      edificioGlobaleId: 701\n    });\n  }\n});\n'''
test.write_text(t, encoding='utf-8')
