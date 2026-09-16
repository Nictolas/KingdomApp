from pathlib import Path
import re

path = Path("app/mappa.tsx")
text = path.read_text(encoding="utf-8")

old_import = 'import type { MappaRuntimeState } from "../src/game/mappaTypes";'
new_import = 'import type { EdificioInCellaMappa as EdificioInCella, MappaRuntimeState } from "../src/game/mappaTypes";'
if text.count(old_import) != 1:
    raise SystemExit(f"Expected exactly one mappaTypes import, found {text.count(old_import)}")
text = text.replace(old_import, new_import, 1)

pattern = r'\ntype EdificioInCella = \{\n.*?\n\};\n\n(?=/\*\* Sabbia)'
text, count = re.subn(pattern, "\n", text, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f"Expected exactly one local EdificioInCella type block, found {count}")

path.write_text(text, encoding="utf-8")
