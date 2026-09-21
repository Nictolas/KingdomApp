import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("la Mappa usa Porto e Culto delle Ombre senza renderer sci-fi attivi", () => {
  const mappa = readFileSync("app/mappa.tsx", "utf8");
  const renderer = readFileSync("src/components/RpgFootprintBuilding.tsx", "utf8");
  const layout = readFileSync("src/game/mappaLayoutConfig.ts", "utf8");
  const costruzioni = readFileSync("src/game/mappaCostruzioneFootprints.ts", "utf8");
  const iniziali = readFileSync("src/game/mappaEdificiInizialiPiazzamento.ts", "utf8");
  const statici = readFileSync("src/game/mappaEdificiStatici.ts", "utf8");

  assert.match(mappa, /\? "porto"/);
  assert.match(mappa, /luogo_culto_ombre/);
  assert.doesNotMatch(mappa, /RpgFootprintSpazioporto4x3|luogo_culto_alieni|\? "spazioporto"/);

  assert.match(renderer, /RpgFootprintLuogoCultoOmbre2x2/);
  assert.doesNotMatch(renderer, /RpgFootprintLuogoCultoAlieni2x2/);

  assert.match(layout, /PORTO_FOOTPRINT_W = 4/);
  assert.match(layout, /PORTO_FOOTPRINT_H = 3/);
  assert.doesNotMatch(layout, /SPAZIOPORTO_FOOTPRINT|SPAZIOPORTO_INDEX/);

  assert.deepEqual(
    [costruzioni.includes("Porto:"), costruzioni.includes('"Luogo di Culto delle Ombre"')],
    [true, true]
  );
  assert.doesNotMatch(costruzioni, /Spazioporto:|Luogo di Culto degli Alieni/);
  assert.doesNotMatch(iniziali, /aggiungiSpazioportoFootprint|SPAZIOPORTO_/);
  assert.doesNotMatch(statici, /SPAZIOPORTO_EDIFICIO/);
});
