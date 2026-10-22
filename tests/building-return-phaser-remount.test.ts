import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { markBuildingExitForMapRecovery, consumeBuildingExitForMapRecovery } from "../src/navigation/mapReturnRecovery.ts";
import { tornaAllaMappa } from "../src/navigation/tornaAllaMappa.ts";
import { EDIFICIO_TO_ROUTE } from "../src/game/mappaEdificioRoutes.ts";

const src = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("un ritorno dall'edificio richiede una sola reinizializzazione del renderer", () => {
  assert.equal(consumeBuildingExitForMapRecovery(), false);
  markBuildingExitForMapRecovery();
  assert.equal(consumeBuildingExitForMapRecovery(), true);
  assert.equal(consumeBuildingExitForMapRecovery(), false);
});

test("chiudere Bar, Serra, Bosco e altre route segnala sempre il recupero", () => {
  const events: string[] = [];
  const router = {
    canGoBack: () => true,
    back: () => {
      // Il segnale deve precedere il pop, altrimenti il focus puo' arrivare prima.
      events.push(consumeBuildingExitForMapRecovery() ? "recreate" : "missing");
    },
    replace: () => events.push("replace")
  };
  for (const name of ["Bar", "Serra", "Bosco", "Tribunale"]) {
    assert.ok(EDIFICIO_TO_ROUTE[name as keyof typeof EDIFICIO_TO_ROUTE]);
    tornaAllaMappa(router as Parameters<typeof tornaAllaMappa>[0]);
  }
  assert.deepEqual(events, ["recreate", "recreate", "recreate", "recreate"]);
});

test("deep link a un edificio senza stack non richiede riavvio inutile", () => {
  let replaced = false;
  tornaAllaMappa({
    canGoBack: () => false,
    back: () => { throw Error("non deve chiamare back"); },
    replace: (href: string) => { assert.equal(href, "/"); replaced = true; }
  } as Parameters<typeof tornaAllaMappa>[0]);
  assert.equal(replaced, true);
  assert.equal(consumeBuildingExitForMapRecovery(), false);
});

test("solo Phaser si rimonta, il GameProvider e la sessione rimangono stabili", () => {
  const map = src("app/mappa.tsx");
  const surface = src("src/components/PhaserMapSurface.web.tsx");
  const scene = src("src/phaser/scenes/KingdomMapScene.ts");
  const root = src("app/_layout.tsx");
  assert.match(map, /consumeBuildingExitForMapRecovery\(\)/);
  assert.match(map, /phaserMapRef\.current\?\.captureCamera\(\)/);
  assert.match(map, /setPhaserSurfaceRevision\(\(old\) => old \+ 1\)/);
  assert.match(map, /<PhaserMapSurface\s+key=\{phaserSurfaceRevision\}/);
  assert.match(surface, /game\.destroy\(true\)/);
  assert.match(surface, /new KingdomMapScene\(bridge, sheetUrl, artUrls, initialCamera\)/);
  assert.match(scene, /this\.cameras\.main\.setScroll\(this\.restoreCamera\.scrollX, this\.restoreCamera\.scrollY\)/);
  assert.match(root, /<GameProvider>/);
  assert.doesNotMatch(src("src/navigation/mapReturnRecovery.ts"), /localStorage|sessionStorage|setMappaSessione/);
});
