from pathlib import Path

mappa = Path("app/mappa.tsx")
text = mappa.read_text(encoding="utf-8")

old_import = '''  SERRA_2_EDIFICIO,\n  SERRA_EDIFICIO,\n  STRADA_OPZIONE,\n  TRIBUNALE_EDIFICIO\n} from "../src/game/mappaEdificiStatici";'''
new_import = '''  SERRA_2_EDIFICIO,\n  SERRA_EDIFICIO,\n  SPAZIOPORTO_EDIFICIO,\n  STRADA_OPZIONE,\n  TRIBUNALE_EDIFICIO\n} from "../src/game/mappaEdificiStatici";'''
if text.count(old_import) != 1:
    raise SystemExit(f"Expected one static entities import block, found {text.count(old_import)}")
text = text.replace(old_import, new_import, 1)

old_const = 'const SPAZIOPORTO_EDIFICIO: EdificioInCella = { id: 19, nome: "Spazioporto", emoji: "🚀" };\n\n'
if text.count(old_const) != 1:
    raise SystemExit(f"Expected one local SPAZIOPORTO_EDIFICIO, found {text.count(old_const)}")
text = text.replace(old_const, "", 1)
mappa.write_text(text, encoding="utf-8")

static_file = Path("src/game/mappaEdificiStatici.ts")
static_text = static_file.read_text(encoding="utf-8")
anchor = 'export const CAPANNA: EdificioInCellaMappa = { id: 20, nome: "Capanna", emoji: "⛺" };\n'
addition = anchor + 'export const SPAZIOPORTO_EDIFICIO: EdificioInCellaMappa = { id: 19, nome: "Spazioporto", emoji: "🚀" };\n'
if static_text.count(anchor) != 1:
    raise SystemExit("CAPANNA anchor not found exactly once")
if "SPAZIOPORTO_EDIFICIO" in static_text:
    raise SystemExit("SPAZIOPORTO_EDIFICIO already exists in static module")
static_text = static_text.replace(anchor, addition, 1)
static_file.write_text(static_text, encoding="utf-8")

test_file = Path("tests/mappa-edifici-statici.test.ts")
test_text = test_file.read_text(encoding="utf-8")
old_test_import = '''  SERRA_2_EDIFICIO,\n  SERRA_EDIFICIO,\n  STRADA_OPZIONE,'''
new_test_import = '''  SERRA_2_EDIFICIO,\n  SERRA_EDIFICIO,\n  SPAZIOPORTO_EDIFICIO,\n  STRADA_OPZIONE,'''
if test_text.count(old_test_import) != 1:
    raise SystemExit("Test import anchor not found exactly once")
test_text = test_text.replace(old_test_import, new_test_import, 1)
old_entries = '''    SERRA_EDIFICIO,\n    SERRA_2_EDIFICIO,\n    CAPANNA\n  ];'''
new_entries = '''    SERRA_EDIFICIO,\n    SERRA_2_EDIFICIO,\n    CAPANNA,\n    SPAZIOPORTO_EDIFICIO\n  ];'''
if test_text.count(old_entries) != 1:
    raise SystemExit("Test entries anchor not found exactly once")
test_text = test_text.replace(old_entries, new_entries, 1)
old_expected = '''      { id: 21, nome: "Serra", emoji: "🌱" },\n      { id: 20, nome: "Capanna", emoji: "⛺" }\n    ]'''
new_expected = '''      { id: 21, nome: "Serra", emoji: "🌱" },\n      { id: 20, nome: "Capanna", emoji: "⛺" },\n      { id: 19, nome: "Spazioporto", emoji: "🚀" }\n    ]'''
if test_text.count(old_expected) != 1:
    raise SystemExit("Test expected anchor not found exactly once")
test_text = test_text.replace(old_expected, new_expected, 1)
test_file.write_text(test_text, encoding="utf-8")
