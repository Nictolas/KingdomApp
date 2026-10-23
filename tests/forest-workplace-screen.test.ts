import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { EDIFICIO_TO_ROUTE } from "../src/game/mappaEdificioRoutes";
import { SEDI_FORESTALI } from "../src/game/turniForestali";

test("Tutte le sedi forestali hanno route alla scheda per ID istanza", () => {
  const mappa = readFileSync("app/mappa.tsx", "utf8");
  const route = readFileSync("app/sede-forestale/[id].tsx", "utf8");
  for (const sede of SEDI_FORESTALI) {
    assert.equal(EDIFICIO_TO_ROUTE[sede], "/sede-forestale");
  }
  assert.match(mappa, /router\.push\(\`\/sede-forestale\/\$\{edificioId\}\`\)/);
  assert.match(route, /e\.id === edificioId/);
  assert.match(route, /getServiDellaGlebaPerAssegnazioneEdificio/);
  assert.match(route, /assegnaServoDellaGlebaAEdificio/);
});

test("Le sedi hanno un solo pulsante uscita nel footer inferiore", () => {
  const source = readFileSync("app/sede-forestale/[id].tsx", "utf8");
  assert.match(source, /style=\{styles\.footer\}/);
  assert.match(source, /accessibilityLabel="Esci dall'edificio e torna alla mappa"/);
  assert.match(source, /router\.back\(\)/);
  assert.ok(source.indexOf("<ScrollView") < source.indexOf("style={styles.footer}"));
});
