import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(projectRoot, file), "utf8");

test("la base comune degli edifici offre header, scroll verticale e navigazione", () => {
  const shell = read("src/ui/BuildingScreenShell.tsx");
  assert.match(shell, /export function BuildingScreenShell/);
  assert.match(shell, /<ScrollView/);
  assert.match(shell, /keyboardShouldPersistTaps="handled"/);
  assert.match(shell, /footerActions/);
  assert.match(shell, /useSafeAreaInsets/);
});

test("Serra singola: mobile a colonne verticali, senza scroll orizzontali annidati", () => {
  const serra = read("app/serra/[id].tsx");
  assert.match(serra, /<BuildingScreenShell/);
  assert.match(serra, /contentStyle=\{isDesktop \? styles\.contentRow : styles\.contentColumn\}/);
  assert.doesNotMatch(serra, /horizontal=\{!isDesktop\}/);
  assert.doesNotMatch(serra, /<ScrollView/);
  assert.match(serra, /setColturaSerra\(serra\.id, c\.id\)/);
  assert.match(serra, /rimuoviAbitanteDaEdificio\(a\.id, serra\.id\)/);
  assert.match(serra, /assegnaServoDellaGlebaAEdificio\(a\.id, serra\.id\)/);
});

test("Dormitorio fullscreen: nessuna trasparenza e callback di assegnazione conservati", () => {
  const map = read("app/mappa.tsx");
  const dorm = read("src/ui/DormitorioFullscreenModal.tsx");
  assert.match(map, /edificioResidenzaAperta\?\.nome === "Dormitorio"/);
  assert.match(map, /<DormitorioFullscreenModal/);
  assert.match(map, /onRemove=\{handleRimuoviDaCasaMappa\}/);
  assert.match(map, /onAdd=\{handleAggiungiACasaMappa\}/);
  assert.match(dorm, /transparent=\{false\}/);
  assert.match(dorm, /presentationStyle="fullScreen"/);
  assert.match(dorm, /<BuildingScreenShell/);
  assert.match(dorm, /onRequestClose=\{onClose\}/);
  assert.match(dorm, /onPress=\{\(\) => onRemove\(occupante\.id\)\}/);
  assert.match(dorm, /onPress=\{\(\) => onAdd\(abitante\.id\)\}/);
});
