import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ASPETTO_GIOCATORE_DEFAULT, creaCharacterAppearance } from "../src/game/personaggioAspetto";
import { CAMPI_ABITO_SACERDOTE, applicaSoloAbitoSacerdote, soloCampiAbitoSacerdote } from "../src/game/soloAbitoSacerdote";
import type { CharacterAppearance } from "../src/character-system/types";

test("abito sacerdote: identità, pelle, sesso LPC, capelli e volto invariati al salvataggio", () => {
  const originale = {
    ...ASPETTO_GIOCATORE_DEFAULT,
    colorePelle: "bruna",
    coloreCapelli: "nero",
    characterAppearance: {
      ...creaCharacterAppearance("Umano", "female"),
      skinTone: "tan",
      hairStyle: "long",
      hairColor: "black",
      eyeColor: "blue"
    }
  };
  const modificato = {
    ...originale,
    colorePelle: "chiara",
    coloreCapelli: "rosa",
    stileOcchi: "allegri" as const,
    characterAppearance: {
      ...originale.characterAppearance,
      race: "orc" as const,
      bodyType: "male",
      ageGroup: "teen" as const,
      skinTone: "light",
      hairStyle: "short",
      hairColor: "red",
      eyeColor: "green",
      fullOutfit: "kimono",
      outfitPrimaryColor: "red",
      cape: "solid"
    }
  };
  const result = applicaSoloAbitoSacerdote(originale, modificato);
  assert.equal(result.colorePelle, originale.colorePelle);
  assert.equal(result.coloreCapelli, originale.coloreCapelli);
  assert.equal(result.stileOcchi, originale.stileOcchi);
  assert.equal(result.characterAppearance?.race, "human");
  assert.equal(result.characterAppearance?.bodyType, originale.characterAppearance.bodyType);
  assert.equal(result.characterAppearance?.ageGroup, originale.characterAppearance.ageGroup);
  assert.equal(result.characterAppearance?.skinTone, "tan");
  assert.equal(result.characterAppearance?.hairStyle, "long");
  assert.equal(result.characterAppearance?.hairColor, "black");
  assert.equal(result.characterAppearance?.eyeColor, "blue");
  assert.equal(result.characterAppearance?.fullOutfit, "kimono");
  assert.equal(result.characterAppearance?.outfitPrimaryColor, "red");
  assert.equal(result.characterAppearance?.cape, "solid");
  assert.equal(originale.characterAppearance.fullOutfit, "none", "non mutare la fonte");
});

test("abito sacerdote: la patch LPC accetta esclusivamente campi di vestiario", () => {
  const patch: Partial<CharacterAppearance> = {
    race: "orc",
    skinTone: "purple",
    hairStyle: "pink",
    headStyle: "other",
    upperOutfit: "robe",
    outfitPrimaryColor: "purple",
    cape: "solid",
    footwear: "shoes"
  };
  const filtered = soloCampiAbitoSacerdote(patch);
  assert.deepEqual(filtered, {
    upperOutfit: "robe",
    outfitPrimaryColor: "purple",
    footwear: "shoes",
    cape: "solid"
  });
  assert.equal(CAMPI_ABITO_SACERDOTE.includes("headwear"), true);
});

test("abito sacerdote: l'editor toglie Identità, Capelli e Sorprendimi solo in modalità outfit", () => {
  const source = readFileSync("src/ui/CreazioneGiocatoreModal.tsx", "utf8");
  assert.match(source, /mode !== "outfit" \|\| \(tab\.id !== "identity" && tab\.id !== "hair" && tab\.id !== "beard"\)/);
  assert.match(source, /mode !== "outfit" && activeTab === "identity"/);
  assert.match(source, /mode !== "outfit" && activeTab === "hair"/);
  assert.match(source, /mode !== "outfit" && \(\s*<Pressable style=\{\[styles\.randomButton/);
  assert.match(source, /applicaSoloAbitoSacerdote\(initial\?\.aspetto \?\? ASPETTO_OUTFIT_DEFAULT, aspetto\)/);
  assert.match(source, /mode === "outfit" \? soloCampiAbitoSacerdote\(patch\) : patch/);
  assert.match(source, /const selectableTabs = CREATION_TABS[\s\S]*?\.filter/);
  assert.match(source, /const activeTabIndex = selectableTabs\.findIndex/);
  assert.match(source, /const target = selectableTabs\[/);
  assert.match(source, /setActiveTab\(mode === "outfit" \? "busto" : "identity"\)/);
});

test("editor completo del Re continua a mostrare le schede Identità e Capelli", () => {
  const source = readFileSync("src/ui/CreazioneGiocatoreModal.tsx", "utf8");
  assert.match(source, /\{ id: "identity", label: "Identità" \}/);
  assert.match(source, /\{ id: "hair", label: "Capelli" \}/);
  assert.match(source, /mode === "outfit" \? "Salva abiti" :/);
});
