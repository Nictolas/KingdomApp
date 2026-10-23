import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { EDIFICIO_TO_ROUTE } from "../src/game/mappaEdificioRoutes.ts";
import { BOSCO_NORD_LATO } from "../src/game/mappaBoscoNord.ts";

test("il Bosco ha una pagina apribile e occupa un footprint di cinque celle", () => {
  assert.equal(EDIFICIO_TO_ROUTE.Bosco, "/bosco");
  assert.equal(BOSCO_NORD_LATO, 5);
});

test("tutta la fascia settentrionale e le cinque celle del Bosco aprono direttamente la pagina con un tap", () => {
  const map = readFileSync(new URL("../app/mappa.tsx", import.meta.url), "utf8");
  const single = map.indexOf('if (edificio?.nome === "Bosco" || cellaNellaForestaNord(');
  const doubleTap = map.indexOf("const isDoubleTap = lastTapCell.current");
  assert.ok(single !== -1 && doubleTap !== -1 && single < doubleTap);
  assert.match(map.slice(single, doubleTap), /openRouteForEdificio\("Bosco"\)/);
  assert.match(map.slice(single, doubleTap), /cellaNellaForestaNord\(cellIndex, cols, rows\)/);
  assert.match(map.slice(single, doubleTap), /lastTapCell\.current = null;/);
});

test("Bosco usa il pulsante universale fisso in basso, senza Indietro in alto", () => {
  const bosco = readFileSync(new URL("../app/bosco.tsx", import.meta.url), "utf8");
  const layout = readFileSync(new URL("../app/_layout.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(bosco, /router\.back\(\)|← Indietro/);
  assert.match(layout, /<BuildingBottomExit\s*\/>/);
  assert.equal(EDIFICIO_TO_ROUTE.Bosco, "/bosco");
});
