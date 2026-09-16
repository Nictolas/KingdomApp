from pathlib import Path

app_path = Path("app/mappa.tsx")
app = app_path.read_text(encoding="utf-8")

old_import = 'import { EDIFICIO_TO_ROUTE } from "../src/game/mappaEdificioRoutes";\n\n\n'
new_import = 'import { EDIFICIO_TO_ROUTE } from "../src/game/mappaEdificioRoutes";\nimport { FOOTPRINT_COSTRUZIONE } from "../src/game/mappaCostruzioneFootprints";\n\n\n'
if old_import not in app:
    raise SystemExit("Expected building-routes import marker not found")
app = app.replace(old_import, new_import, 1)

old_table = '''/** Footprint costruzioni giocatore (allineato agli edifici procedurali iniziali). */
const FOOTPRINT_COSTRUZIONE: Record<string, { w: number; h: number }> = {
  Strada: { w: STRADA_FOOTPRINT_W, h: STRADA_FOOTPRINT_H },
  Serra: { w: SERRA_FOOTPRINT_W, h: SERRA_FOOTPRINT_H },
  Capanna: { w: CAPANNA_FOOTPRINT_W, h: CAPANNA_FOOTPRINT_H },
  Dormitorio: { w: DORMITORIO_FOOTPRINT_W, h: DORMITORIO_FOOTPRINT_H },
  Bar: { w: BAR_FOOTPRINT_W, h: BAR_FOOTPRINT_H },
  Tribunale: { w: TRIBUNALE_FOOTPRINT_W, h: TRIBUNALE_FOOTPRINT_H },
  "Ufficio Immigrazione": { w: UFFICIO_IMMIGRAZIONE_FOOTPRINT_W, h: UFFICIO_IMMIGRAZIONE_FOOTPRINT_H },
  "Ufficio Edile": { w: UFFICIO_EDILE_FOOTPRINT_W, h: UFFICIO_EDILE_FOOTPRINT_H },
  Mercato: { w: MERCATO_FOOTPRINT_W, h: MERCATO_FOOTPRINT_H },
  Negozio: { w: NEGOZIO_FOOTPRINT_W, h: NEGOZIO_FOOTPRINT_H },
  "Mensa Pubblica": { w: MERCATO_FOOTPRINT_W, h: MERCATO_FOOTPRINT_H },
  Dissalatore: { w: DISSALATORE_FOOTPRINT_W, h: DISSALATORE_FOOTPRINT_H },
  Spazioporto: { w: SPAZIOPORTO_FOOTPRINT_W, h: SPAZIOPORTO_FOOTPRINT_H },
  "Luogo di Culto del Sole": { w: 2, h: 2 },
  "Luogo di Culto degli Alieni": { w: 2, h: 2 },
  Carcere: { w: 2, h: 2 },
  "Campo di Lavoro": { w: 2, h: 2 },
  "Campo di Sterminio": { w: 2, h: 2 }
};

'''
if old_table not in app:
    raise SystemExit("Expected FOOTPRINT_COSTRUZIONE table not found")
app = app.replace(old_table, "", 1)
app_path.write_text(app, encoding="utf-8")

module = '''import {
  BAR_FOOTPRINT_H,
  BAR_FOOTPRINT_W,
  CAPANNA_FOOTPRINT_H,
  CAPANNA_FOOTPRINT_W,
  DISSALATORE_FOOTPRINT_H,
  DISSALATORE_FOOTPRINT_W,
  DORMITORIO_FOOTPRINT_H,
  DORMITORIO_FOOTPRINT_W,
  MERCATO_FOOTPRINT_H,
  MERCATO_FOOTPRINT_W,
  NEGOZIO_FOOTPRINT_H,
  NEGOZIO_FOOTPRINT_W,
  SERRA_FOOTPRINT_H,
  SERRA_FOOTPRINT_W,
  SPAZIOPORTO_FOOTPRINT_H,
  SPAZIOPORTO_FOOTPRINT_W,
  TRIBUNALE_FOOTPRINT_H,
  TRIBUNALE_FOOTPRINT_W,
  UFFICIO_EDILE_FOOTPRINT_H,
  UFFICIO_EDILE_FOOTPRINT_W,
  UFFICIO_IMMIGRAZIONE_FOOTPRINT_H,
  UFFICIO_IMMIGRAZIONE_FOOTPRINT_W
} from "./mappaLayoutConfig";
import { STRADA_FOOTPRINT_H, STRADA_FOOTPRINT_W } from "./stradaFootprint";

export type MappaCostruzioneFootprint = { w: number; h: number };

/** Footprint costruzioni giocatore, separati dalla logica runtime di piazzamento. */
export const FOOTPRINT_COSTRUZIONE: Record<string, MappaCostruzioneFootprint> = {
  Strada: { w: STRADA_FOOTPRINT_W, h: STRADA_FOOTPRINT_H },
  Serra: { w: SERRA_FOOTPRINT_W, h: SERRA_FOOTPRINT_H },
  Capanna: { w: CAPANNA_FOOTPRINT_W, h: CAPANNA_FOOTPRINT_H },
  Dormitorio: { w: DORMITORIO_FOOTPRINT_W, h: DORMITORIO_FOOTPRINT_H },
  Bar: { w: BAR_FOOTPRINT_W, h: BAR_FOOTPRINT_H },
  Tribunale: { w: TRIBUNALE_FOOTPRINT_W, h: TRIBUNALE_FOOTPRINT_H },
  "Ufficio Immigrazione": { w: UFFICIO_IMMIGRAZIONE_FOOTPRINT_W, h: UFFICIO_IMMIGRAZIONE_FOOTPRINT_H },
  "Ufficio Edile": { w: UFFICIO_EDILE_FOOTPRINT_W, h: UFFICIO_EDILE_FOOTPRINT_H },
  Mercato: { w: MERCATO_FOOTPRINT_W, h: MERCATO_FOOTPRINT_H },
  Negozio: { w: NEGOZIO_FOOTPRINT_W, h: NEGOZIO_FOOTPRINT_H },
  "Mensa Pubblica": { w: MERCATO_FOOTPRINT_W, h: MERCATO_FOOTPRINT_H },
  Dissalatore: { w: DISSALATORE_FOOTPRINT_W, h: DISSALATORE_FOOTPRINT_H },
  Spazioporto: { w: SPAZIOPORTO_FOOTPRINT_W, h: SPAZIOPORTO_FOOTPRINT_H },
  "Luogo di Culto del Sole": { w: 2, h: 2 },
  "Luogo di Culto degli Alieni": { w: 2, h: 2 },
  Carcere: { w: 2, h: 2 },
  "Campo di Lavoro": { w: 2, h: 2 },
  "Campo di Sterminio": { w: 2, h: 2 }
};
'''
Path("src/game/mappaCostruzioneFootprints.ts").write_text(module, encoding="utf-8")

test = '''import assert from "node:assert/strict";
import test from "node:test";

import { FOOTPRINT_COSTRUZIONE } from "../src/game/mappaCostruzioneFootprints.ts";

test("FOOTPRINT_COSTRUZIONE conserva tutti i 18 mapping e le dimensioni correnti", () => {
  assert.deepEqual(FOOTPRINT_COSTRUZIONE, {
    Strada: { w: 2, h: 2 },
    Serra: { w: 2, h: 1 },
    Capanna: { w: 2, h: 1 },
    Dormitorio: { w: 2, h: 2 },
    Bar: { w: 2, h: 2 },
    Tribunale: { w: 2, h: 2 },
    "Ufficio Immigrazione": { w: 2, h: 2 },
    "Ufficio Edile": { w: 2, h: 2 },
    Mercato: { w: 2, h: 2 },
    Negozio: { w: 2, h: 2 },
    "Mensa Pubblica": { w: 2, h: 2 },
    Dissalatore: { w: 2, h: 2 },
    Spazioporto: { w: 4, h: 3 },
    "Luogo di Culto del Sole": { w: 2, h: 2 },
    "Luogo di Culto degli Alieni": { w: 2, h: 2 },
    Carcere: { w: 2, h: 2 },
    "Campo di Lavoro": { w: 2, h: 2 },
    "Campo di Sterminio": { w: 2, h: 2 }
  });
  assert.equal(Object.keys(FOOTPRINT_COSTRUZIONE).length, 18);
});
'''
Path("tests/mappa-costruzione-footprints.test.ts").write_text(test, encoding="utf-8")
