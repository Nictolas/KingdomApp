import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MapSceneBridge, type PhaserMapSnapshot } from "../src/phaser/adapters/mapSceneBridge";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("il bridge ripristina input senza sostituire la scena o la mappa", () => {
  const bridge = new MapSceneBridge({} as PhaserMapSnapshot, { onCellPress: () => {} });
  let resumed = 0;
  bridge.resumeInteractions(); // no-op prima che Phaser venga montato
  bridge.registerSceneControls({
    refreshViewport: () => {},
    resumeInteractions: () => { resumed += 1; },
    centerOnCell: () => {}
  });
  bridge.resumeInteractions();
  bridge.resumeInteractions();
  assert.equal(resumed, 2);
  bridge.registerSceneControls(null);
  bridge.resumeInteractions();
  assert.equal(resumed, 2);
});

test("al ritorno in mappa il focus resetta il pointer Phaser e il drag React", () => {
  const map = read("app/mappa.tsx");
  const surface = read("src/components/PhaserMapSurface.web.tsx");
  const scene = read("src/phaser/scenes/KingdomMapScene.ts");
  assert.match(map, /useFocusEffect\(/);
  assert.match(map, /mapDraggedRef\.current = false/);
  assert.match(map, /panStartPosRef\.current = null/);
  assert.match(map, /phaserMapRef\.current\?\.resumeInteractions\(\)/);
  assert.match(map, /phaserMapRef\.current\?\.refreshViewport\(\)/);
  assert.match(scene, /this\.input\.resetPointers\(\)/);
  assert.match(surface, /runtime\.game\.input\.enabled = true/);
  assert.match(surface, /runtime\.bridge\.resumeInteractions\(\)/);
  assert.match(scene, /private resumeInteractionAfterFocus\(\): void/);
  assert.match(scene, /this\.dragPointerId = null/);
  assert.match(scene, /this\.input\.enabled = true/);
  assert.match(scene, /this\.bridge\.setDragging\(false\)/);
});

test("Bar, Serra e Mensa tornano direttamente alla mappa persistente", () => {
  for (const page of ["app/bar/[id].tsx","app/serra/[id].tsx","app/mensa/[id].tsx"]) {
    const source = read(page);
    assert.match(source, /onBack=\{\(\) => tornaAllaMappa\(router\)\}/, page);
    assert.match(source, /backLabel="Mappa"/, page);
    assert.doesNotMatch(source, /onBack=\{\(\) => router\.back\(\)\}/, page);
  }
});

test("anche chiudendo le modali residenza si ripristina l'input senza cambiare pagina", () => {
  const map = read("app/mappa.tsx");
  assert.match(map, /const mapModalOpen =/);
  assert.match(map, /selectedResidenzaAnchor !== null/);
  assert.match(map, /selectedLuogoCultoAnchor !== null/);
  assert.match(map, /mapModalWasOpenRef\.current = true/);
  assert.match(map, /setTimeout\(restoreMapInput, 50\)/);
  assert.match(map, /setTimeout\(restoreMapInput, 350\)/);
});
