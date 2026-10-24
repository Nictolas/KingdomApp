import assert from "node:assert/strict";
import test from "node:test";

import { FOOTPRINT_COSTRUZIONE } from "../src/game/mappaCostruzioneFootprints.ts";

test("FOOTPRINT_COSTRUZIONE conserva tutti i 18 mapping e le dimensioni correnti", () => {
  const mappingStorici = {
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
    Porto: { w: 4, h: 3 },
    "Luogo di Culto del Sole": { w: 2, h: 2 },
    "Luogo di Culto delle Ombre": { w: 2, h: 2 },
    Carcere: { w: 2, h: 2 },
    "Campo di Lavoro": { w: 2, h: 2 },
    "Campo di Sterminio": { w: 2, h: 2 }
  };
  for (const [nome, valore] of Object.entries(mappingStorici)) {
    assert.deepEqual(FOOTPRINT_COSTRUZIONE[nome], valore, nome);
  }
  assert.ok(Object.keys(FOOTPRINT_COSTRUZIONE).length > 18);
  assert.deepEqual(FOOTPRINT_COSTRUZIONE["Capanna del Cacciatore"], { w: 1, h: 1 });
});
