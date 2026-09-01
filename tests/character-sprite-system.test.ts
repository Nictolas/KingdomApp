import assert from "node:assert/strict";
import test from "node:test";

import { appearanceForPublicSpace, bodyFamilyFor, DEFAULT_CHARACTER_APPEARANCE, normalizeCharacterAppearance } from "../src/character-system/appearance.ts";
import { LPC_DIRECTION_ROWS, LPC_SHEETS } from "../src/character-system/lpcPack.ts";
import { CHARACTER_ASSETS, CHARACTER_CATALOG_OPTIONS, LPC_RUNTIME_MANIFEST, compatibleCatalogOptions, isAssetCompatible, rendererKindFor, resolveCharacterLayers } from "../src/character-system/registry.ts";
import { deserializeCharacterAppearance, serializeCharacterAppearance } from "../src/character-system/serialization.ts";
import { generaAspettoCasuale } from "../src/game/personaggioAspetto.ts";

test("mapping race e age -> body family", () => {
  assert.equal(bodyFamilyFor("human"), "humanAdult");
  assert.equal(bodyFamilyFor("elf"), "humanAdult");
  assert.equal(bodyFamilyFor("dwarf"), "dwarfAdult");
  assert.equal(bodyFamilyFor("halfling"), "halflingAdult");
  assert.equal(bodyFamilyFor("orc"), "orcAdult");
  assert.equal(bodyFamilyFor("human", "child"), "humanChild");
});

test("registry LPC espone solo asset reali e compatibili", () => {
  assert.equal(CHARACTER_ASSETS.length, LPC_RUNTIME_MANIFEST.assets.length);
  assert.ok(CHARACTER_ASSETS.length >= 400);
  const asset = CHARACTER_ASSETS[0]!;
  assert.equal(asset.assetPack, "lpc");
  assert.ok(isAssetCompatible(asset, DEFAULT_CHARACTER_APPEARANCE));
  assert.equal(isAssetCompatible(asset, normalizeCharacterAppearance({ race: "dwarf" })), false);
});

test("mapping direzioni e definizioni idle/walk LPC", () => {
  assert.deepEqual(LPC_DIRECTION_ROWS, { up: 0, left: 1, down: 2, right: 3 });
  assert.equal(LPC_SHEETS["lpc-human-male-idle"]!.animations.idle!.frames, 2);
  assert.equal(LPC_SHEETS["lpc-human-male-walk"]!.animations.walk!.frames, 9);
  assert.equal(LPC_SHEETS["lpc-human-male-walk"]!.frameWidth, 64);
  assert.equal(LPC_SHEETS["lpc-human-male-walk"]!.frameHeight, 64);
});

test("resolver seleziona idle/walk e fallback per asset mancanti", () => {
  assert.equal(resolveCharacterLayers(DEFAULT_CHARACTER_APPEARANCE, "idle")[0]!.sheet.id, "lpc-generated-idle");
  assert.equal(resolveCharacterLayers(DEFAULT_CHARACTER_APPEARANCE, "walk")[0]!.sheet.id, "lpc-generated-walk");
  assert.equal(rendererKindFor(DEFAULT_CHARACTER_APPEARANCE, "walk"), "sprite");
  assert.equal(rendererKindFor(normalizeCharacterAppearance({ bodyType: "female" }), "walk"), "sprite");
  assert.equal(rendererKindFor(normalizeCharacterAppearance({ race: "orc" }), "idle"), "legacy");
});

test("catalogo generato non contiene ID duplicati e riusa le sorgenti condivise", () => {
  const ids = LPC_RUNTIME_MANIFEST.assets.map((asset) => asset.id);
  const sourceKeys = LPC_RUNTIME_MANIFEST.assets.map((asset) => asset.sourceKey);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(new Set(sourceKeys).size > 250);
  assert.ok(new Set(sourceKeys).size <= sourceKeys.length);
  assert.deepEqual(CHARACTER_CATALOG_OPTIONS.bodyTypes.sort(), ["child", "female", "male", "teen"]);
});

test("compatibilità filtra opzioni per corporatura", () => {
  const child = normalizeCharacterAppearance({ bodyType: "child", ageGroup: "child", bodyFamily: "humanChild", outfit: "none", hairStyle: "relm_short" });
  const options = compatibleCatalogOptions(child);
  assert.ok(options.skinTones.includes("light"));
  assert.ok(options.hairStyles.includes("relm_short"));
  assert.deepEqual(options.beardStyles, ["none"]);
  assert.equal(rendererKindFor(child, "idle"), "sprite");
});

test("outfit superiore e inferiore sono combinabili e i vecchi salvataggi restano compatibili", () => {
  const mixed = normalizeCharacterAppearance({ upperOutfit: "noble", lowerOutfit: "traveler" });
  const layers = resolveCharacterLayers(mixed, "idle");
  assert.ok(layers.some((layer) => layer.layer === "outfit"));
  assert.ok(layers.some((layer) => layer.layer === "lowerBody"));
  assert.equal(rendererKindFor(mixed, "idle"), "sprite");

  const legacy = deserializeCharacterAppearance(JSON.stringify({ ...DEFAULT_CHARACTER_APPEARANCE, upperOutfit: undefined, lowerOutfit: undefined, outfit: "farmer" }));
  assert.equal(legacy.upperOutfit, "farmer");
  assert.equal(legacy.lowerOutfit, "farmer");
});

test("solo il Re mantiene la corona e i pantaloni sono obbligatori senza Nudismo", () => {
  const nakedCrowned = normalizeCharacterAppearance({ outfit: "none", headwear: "crown" });
  const citizen = appearanceForPublicSpace(nakedCrowned, { isKing: false, nudismoAttivo: false });
  assert.equal(citizen.headwear, "none");
  assert.equal(citizen.outfit, "commoner");
  assert.ok(resolveCharacterLayers(citizen, "idle").some((layer) => layer.layer === "lowerBody"));

  const legalNudist = appearanceForPublicSpace(nakedCrowned, { isKing: false, nudismoAttivo: true });
  assert.equal(legalNudist.outfit, "none");
  assert.equal(legalNudist.headwear, "none");
  assert.equal(appearanceForPublicSpace(nakedCrowned, { isKing: true, nudismoAttivo: true }).headwear, "crown");
});

test("randomizzazione produce soltanto combinazioni risolvibili o fallback sicuro", () => {
  for (const race of ["Umano", "Elfo", "Nano", "Orco", "Goblin"] as const) {
    const appearance = generaAspettoCasuale(race, () => 0.5).characterAppearance!;
    const kind = rendererKindFor(appearance, "idle");
    assert.ok(kind === "sprite" || kind === "legacy");
    if (kind === "sprite") {
      assert.ok(resolveCharacterLayers(appearance, "idle").every((asset) => isAssetCompatible(asset, appearance)));
    }
  }
});

test("CharacterAppearance round-trip mantiene ID semantici e nessun path/frame", () => {
  const serialized = serializeCharacterAppearance(DEFAULT_CHARACTER_APPEARANCE);
  const restored = deserializeCharacterAppearance(serialized);
  assert.deepEqual(restored, DEFAULT_CHARACTER_APPEARANCE);
  assert.doesNotMatch(serialized, /\.png|frameWidth|directionRows|spritePath/);
});
