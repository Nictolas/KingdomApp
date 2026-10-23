import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { normalizeCharacterAppearance, ORC_GREEN_SKIN_TONE } from "../src/character-system/appearance";
import { compatibleCatalogOptions, resolveCharacterLayers } from "../src/character-system/registry";
import { COLORE_PELLE_ORCO, normalizzaAspettoOrco, aspettoPerVisualizzazioneAbitante, creaCharacterAppearance, generaAspettoCasuale } from "../src/game/personaggioAspetto";

test("orchi di tutte le corporature, inclusi gli avatar legacy, hanno sempre skinTone orc_green", () => {
  for (const bodyType of ["male", "female", "teen", "child", "muscular", "pregnant"]) {
    const raw = { ...creaCharacterAppearance("Umano", bodyType), race: "orc" as const, bodyType, skinTone: "light", outfit: "none", upperOutfit: "none", lowerOutfit: "none", fullOutfit: "none", hairStyle: "none", beardStyle: "none", headwear: "none" };
    const converted = normalizeCharacterAppearance(raw);
    assert.equal(converted.skinTone, ORC_GREEN_SKIN_TONE);
    assert.equal(normalizeCharacterAppearance({ ...converted, skinTone: "black" }).skinTone, ORC_GREEN_SKIN_TONE);
    assert.deepEqual(compatibleCatalogOptions(converted).skinTones, [ORC_GREEN_SKIN_TONE]);
    for (const animation of ["idle", "walk"] as const) {
      const layers = resolveCharacterLayers(converted, animation);
      const body = layers.find(layer => layer.layer === "body");
      assert.ok(body, bodyType + " " + animation + ": missing green orc body");
      assert.equal(body.sourceId, "lpc_orc_green_" + bodyType + "_" + animation);
      if (bodyType === "male" || bodyType === "female" || bodyType === "teen" || bodyType === "muscular") {
        assert.ok(layers.some(layer => layer.layer === "raceFeatures"), bodyType + ": missing green orc head");
      }
    }
  }
});

test("la generazione casuale degli orchi non introduce pelle marrone", () => {
  for (const random of [() => 0, () => 0.55, () => 0.99]) {
    const generated = generaAspettoCasuale("Orco", random, { sesso: "F", eta: 38 });
    assert.equal(generated.colorePelle, COLORE_PELLE_ORCO);
    assert.equal(generated.characterAppearance?.race, "orc");
    assert.equal(generated.characterAppearance?.skinTone, ORC_GREEN_SKIN_TONE);
  }
});

test("vecchi abitanti orchi con corpo umano e pelle rosa vengono corretti in visualizzazione senza mutare il salvataggio", () => {
  const old = {
    id: 44,
    razza: "Orco",
    eta: 29,
    sesso: "M" as const,
    lavoro: "Disoccupato",
    aspetto: {
      ...generaAspettoCasuale("Umano", () => 0.5),
      colorePelle: "#e9b38f",
      characterAppearance: creaCharacterAppearance("Umano")
    }
  };
  const before = JSON.stringify(old);
  const view = aspettoPerVisualizzazioneAbitante(old)!;
  assert.equal(view.colorePelle, COLORE_PELLE_ORCO);
  assert.equal(view.characterAppearance?.skinTone, ORC_GREEN_SKIN_TONE);
  assert.equal(view.characterAppearance?.race, "orc");
  assert.ok(resolveCharacterLayers(view.characterAppearance!, "idle").some(layer => layer.layer === "body" && layer.sourceId.startsWith("lpc_orc_green_")));
  assert.equal(JSON.stringify(old), before);
});

test("la palette speciale Orc non compare tra i colori della pelle umana", () => {
  assert.ok(!compatibleCatalogOptions(creaCharacterAppearance("Umano")).skinTones.includes(ORC_GREEN_SKIN_TONE));
  const editor = readFileSync("src/ui/CreazioneGiocatoreModal.tsx", "utf8");
  assert.match(editor, /spriteAppearance\.race !== "orc" \? \(/);
  assert.match(editor, /Pelle verde obbligatoria per gli orchi/);
});

test("le immagini verdi LPC sono registrate nel manifest e nella mappa import Expo", () => {
  const manifest = JSON.parse(readFileSync("src/character-system/generated/lpc-manifest.json", "utf8"));
  const sources = readFileSync("src/character-system/generated/lpcAssetSources.ts", "utf8");
  const greenBodies = manifest.assets.filter((entry: { slot: string; color: string }) => entry.slot === "body" && entry.color === ORC_GREEN_SKIN_TONE);
  assert.equal(greenBodies.length, 12);
  for (const entry of greenBodies) assert.ok(sources.includes(entry.sourceKey + '.png'), entry.sourceKey);
});

test("la migrazione dei salvataggi orchi e' ripetibile, preserva abiti e non altera altri personaggi", () => {
  const originale = {
    ...generaAspettoCasuale("Umano", () => 0.5),
    colorePelle: "#e9b38f",
    characterAppearance: {
      ...creaCharacterAppearance("Umano"),
      skinTone: "light",
      outfit: "commoner",
      upperOutfit: "commoner",
      outfitPrimaryColor: "brown"
    }
  };
  const restored = normalizzaAspettoOrco(originale);
  assert.equal(restored.colorePelle, COLORE_PELLE_ORCO);
  assert.equal(restored.characterAppearance?.skinTone, ORC_GREEN_SKIN_TONE);
  assert.equal(restored.characterAppearance?.race, "orc");
  assert.equal(restored.characterAppearance?.upperOutfit, "commoner");
  assert.equal(restored.characterAppearance?.outfitPrimaryColor, "brown");
  assert.deepEqual(normalizzaAspettoOrco(restored), restored);
  assert.equal(originale.colorePelle, "#e9b38f");
  const saveSource = readFileSync("src/persistence/saveValidation.ts", "utf8");
  assert.ok((saveSource.match(/aspetto: normalizzaAspettoOrco\(/g) ?? []).length >= 2);
});
