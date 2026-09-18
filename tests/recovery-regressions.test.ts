import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("la pagina Religione resta presente e raggiungibile da Leggi", () => {
  const religionePath = resolve(process.cwd(), "app/religione.tsx");
  const leggiSource = readFileSync(resolve(process.cwd(), "app/leggi.tsx"), "utf8");

  assert.equal(existsSync(religionePath), true);
  assert.equal(leggiSource.includes('return "/religione"'), true);
  assert.equal(leggiSource.includes('legge.titolo === "Religione"'), true);
});

test("la selezione di un abitante viene inoltrata a Phaser", () => {
  const mapSource = readFileSync(resolve(process.cwd(), "app/mappa.tsx"), "utf8");
  const bridgeSource = readFileSync(resolve(process.cwd(), "src/phaser/adapters/mapSceneBridge.ts"), "utf8");

  assert.equal(mapSource.includes("selected: abitante.id === sintesiMappaAbitanteId"), true);
  assert.equal(bridgeSource.includes("selected?: boolean"), true);
});

test("Phaser mostra un indicatore verde sull'abitante selezionato", () => {
  const sceneSource = readFileSync(resolve(process.cwd(), "src/phaser/scenes/KingdomMapScene.ts"), "utf8");

  assert.equal(sceneSource.includes("selectionRing"), true);
  assert.equal(sceneSource.includes("0x22c55e"), true);
  assert.equal(sceneSource.includes("view.selectionRing.setVisible(character.selected === true)"), true);
});
