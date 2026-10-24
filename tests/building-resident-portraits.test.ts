import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const buildingResidentScreens = [
  "src/ui/CapannaFullscreenModal.tsx",
  "src/ui/DormitorioFullscreenModal.tsx",
  "src/ui/LuogoCultoFullscreenModal.tsx",
  "app/bar/[id].tsx",
  "app/mensa/[id].tsx",
  "app/ospedale.tsx",
  "app/scuola.tsx",
  "app/tribunale.tsx",
  "app/caserma.tsx",
  "app/carcere.tsx",
  "app/laboratorio.tsx",
  "app/centrale.tsx",
  "app/serra/[id].tsx",
  "app/ufficio-edile.tsx",
  "app/culto-sole.tsx",
  "app/dissalatore.tsx",
  "app/impianto-riciclo.tsx",
  "app/acqua.tsx",
  "app/postazioni-lavoro.tsx"
] as const;

test("Every building resident listing uses an LPC portrait rather than the old emoji", () => {
  for (const path of buildingResidentScreens) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /BuildingResidentAvatar/, `Missing building portrait in ${path}`);
    assert.doesNotMatch(source, /getEmojiAbitante\s*\(/, `Old resident emoji remains in ${path}`);
  }
});

test("Building portraits show the resident's face using their saved LPC appearance", () => {
  const source = readFileSync("src/ui/BuildingResidentAvatar.tsx", "utf8");
  assert.match(source, /AbitanteAvatarPreview/);
  assert.match(source, /abitante=\{abitante\}/);
  assert.match(source, /faceOnly/);
  assert.match(source, /liftPx=\{0\}/);
});

test("Mensa recruitment options show a portrait separately from resident names", () => {
  const source = readFileSync("app/mensa/[id].tsx", "utf8");
  assert.match(source, /<BuildingResidentAvatar abitante=\{a\} \/>\s*<Text>\{a\.nome\}<\/Text>/);
});
