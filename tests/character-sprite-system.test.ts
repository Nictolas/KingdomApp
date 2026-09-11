import assert from "node:assert/strict";
import test from "node:test";

import { appearanceForPublicSpace, bodyFamilyFor, DEFAULT_CHARACTER_APPEARANCE, BLACKSMITH_TOOL, FARMER_TOOL, LUMBERJACK_TOOL, MAGO_HAT, MINER_TOOL, normalizeCharacterAppearance } from "../src/character-system/appearance.ts";
import { LPC_DIRECTION_ROWS, LPC_SHEETS } from "../src/character-system/lpcPack.ts";
import { CHARACTER_ASSETS, CHARACTER_CATALOG_OPTIONS, LPC_RUNTIME_MANIFEST, canRenderCharacter, compatibleCatalogOptions, firstCompatibleHairColor, isAssetCompatible, rendererKindFor, resolveCharacterLayers } from "../src/character-system/registry.ts";
import { deserializeCharacterAppearance, serializeCharacterAppearance } from "../src/character-system/serialization.ts";
import { generaAspettoCasuale, testaObbligatoriaRazza } from "../src/game/personaggioAspetto.ts";
import { generaAspettoEsempioOccupazione } from "../src/game/lavoriAspetto.ts";

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
  const asset = CHARACTER_ASSETS.find((candidate) => candidate.bodyFamilies.includes("humanAdult"))!;
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
  assert.deepEqual(CHARACTER_CATALOG_OPTIONS.bodyTypes.sort(), ["child", "female", "male", "muscular", "pregnant", "skeleton", "teen"]);
});

test("compatibilità filtra opzioni per corporatura", () => {
  const child = normalizeCharacterAppearance({ bodyType: "child", ageGroup: "child", bodyFamily: "humanChild", outfit: "none", hairStyle: "relm_short" });
  const options = compatibleCatalogOptions(child);
  assert.ok(options.skinTones.includes("light"));
  assert.ok(options.hairStyles.includes("relm_short"));
  assert.deepEqual(options.beardStyles, ["none", "basic", "medium", "trimmed", "winter"]);
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

test("tutte le opzioni teen del catalogo producono uno sprite completo", () => {
  const teen = normalizeCharacterAppearance({ bodyType: "teen", ageGroup: "teen", bodyFamily: "humanTeen", headwear: "crown" });
  const options = compatibleCatalogOptions(teen);
  assert.ok(options.hairStyles.includes("jewfro"));
  assert.ok(options.fullOutfits.includes("kimono"));

  for (const hairStyle of options.hairStyles) {
    const hairColor = firstCompatibleHairColor(teen, hairStyle);
    assert.equal(rendererKindFor(normalizeCharacterAppearance({ ...teen, hairStyle, hairColor }), "idle"), "sprite", `capelli ${hairStyle}`);
  }
  for (const upperOutfit of options.upperOutfits) {
    assert.equal(rendererKindFor(normalizeCharacterAppearance({ ...teen, fullOutfit: "none", upperOutfit }), "idle"), "sprite", `sopra ${upperOutfit}`);
  }
  for (const lowerOutfit of options.lowerOutfits) {
    assert.equal(rendererKindFor(normalizeCharacterAppearance({ ...teen, fullOutfit: "none", lowerOutfit }), "idle"), "sprite", `sotto ${lowerOutfit}`);
  }
  for (const fullOutfit of options.fullOutfits) {
    assert.equal(rendererKindFor(normalizeCharacterAppearance({ ...teen, fullOutfit }), "idle"), "sprite", `abito intero ${fullOutfit}`);
  }
});

test("catalogo piedi e teste obbligatorie delle razze", () => {
  const teen = normalizeCharacterAppearance({ ...DEFAULT_CHARACTER_APPEARANCE, bodyType: "teen", bodyFamily: "humanTeen", ageGroup: "teen" });
  const footwear = compatibleCatalogOptions(teen).footwear;
  for (const category of ["shoes", "boots", "socks", "armour", "slippers", "sandals", "hoofs"]) {
    assert.ok(footwear.some((value) => value.includes(category)), `manca la categoria ${category}`);
  }
  assert.equal(testaObbligatoriaRazza("Scheletro"), "skeleton");
  assert.equal(testaObbligatoriaRazza("Vampiro"), "vampire");
  assert.equal(testaObbligatoriaRazza("Goblin"), "goblin");
  assert.equal(testaObbligatoriaRazza("Orco", "F"), "orc_female");
  assert.equal(testaObbligatoriaRazza("Orco", "M"), "orc_male");
  assert.equal(testaObbligatoriaRazza("Lucertoloide", "F"), "lizard_female");
  assert.equal(testaObbligatoriaRazza("Lucertoloide", "M"), "lizard_male");
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

test("le abitanti incinte usano bodyType pregnant", () => {
  const incinta = appearanceForPublicSpace(DEFAULT_CHARACTER_APPEARANCE, {
    isKing: false,
    nudismoAttivo: false,
    incinta: true
  });
  assert.equal(incinta.bodyType, "pregnant");
  assert.equal(incinta.ageGroup, "adult");
  assert.equal(incinta.beardStyle, "none");
  assert.ok(canRenderCharacter(incinta, "idle"));
  assert.ok(resolveCharacterLayers(incinta, "idle").some((layer) => layer.layer === "body" && layer.semanticId === "pregnant"));
});

test("le abitanti incinte con outfit incompatibile restano renderizzabili", () => {
  for (let i = 0; i < 200; i++) {
    const base = generaAspettoCasuale("Umano", Math.random, { sesso: "F", eta: 32 });
    const incinta = appearanceForPublicSpace(base.characterAppearance!, {
      isKing: false,
      nudismoAttivo: false,
      incinta: true,
      lavoro: "Disoccupato",
      seed: i
    });
    assert.equal(incinta.bodyType, "pregnant");
    assert.equal(rendererKindFor(incinta, "idle"), "sprite", `seed ${i} hw=${base.characterAppearance!.headwear} outfit=${base.characterAppearance!.upperOutfit}`);
  }
});

test("i Nani usano sempre bodyType child", () => {
  const nano = normalizeCharacterAppearance({ race: "dwarf", bodyType: "male", ageGroup: "adult" });
  assert.equal(nano.bodyType, "child");
  assert.equal(nano.ageGroup, "child");
  assert.equal(nano.bodyFamily, "humanChild");

  const generated = generaAspettoCasuale("Nano", () => 0.5, { eta: 40, sesso: "M" }).characterAppearance!;
  assert.equal(generated.race, "dwarf");
  assert.equal(generated.bodyType, "child");
  assert.equal(generated.ageGroup, "child");
  assert.equal(generated.upperOutfit, "child_shirt");
  assert.equal(generated.lowerOutfit, "child_pants");
  assert.equal(generated.hairStyle, "none");

  const generatedF = generaAspettoCasuale("Nano", () => 0.5, { eta: 40, sesso: "F" }).characterAppearance!;
  assert.equal(generatedF.upperOutfit, "child_shirt");
  assert.equal(generatedF.lowerOutfit, "child_skirt");

  // Anche se l'aspetto salvato ha race human/adulto, la razza di gioco Nano forza il corpo child.
  const salvatoSbagliato = {
    ...DEFAULT_CHARACTER_APPEARANCE,
    race: "human" as const,
    bodyType: "male",
    ageGroup: "adult" as const,
    bodyFamily: "humanAdult" as const
  };
  const pubblico = appearanceForPublicSpace(salvatoSbagliato, {
    isKing: false,
    nudismoAttivo: false,
    razza: "Nano",
    sesso: "M",
    seed: 42
  });
  assert.equal(pubblico.race, "dwarf");
  assert.equal(pubblico.bodyType, "child");
  assert.equal(pubblico.bodyFamily, "humanChild");
  assert.equal(pubblico.upperOutfit, "child_shirt");
  assert.equal(pubblico.lowerOutfit, "child_pants");
  assert.ok(canRenderCharacter(pubblico, "idle"));

  const pubblicoF = appearanceForPublicSpace(salvatoSbagliato, {
    isKing: false,
    nudismoAttivo: false,
    razza: "Nano",
    sesso: "F",
    seed: 7
  });
  assert.equal(pubblicoF.lowerOutfit, "child_skirt");
  assert.ok(canRenderCharacter(pubblicoF, "idle"));

  const nanoMedico = appearanceForPublicSpace(generated, {
    isKing: false,
    nudismoAttivo: false,
    lavoro: "Medico",
    razza: "Nano"
  });
  assert.equal(nanoMedico.bodyType, "child");
  assert.equal(nanoMedico.ageGroup, "child");
});

test("i Nani usano sempre la Winter Beard con colore valido", () => {
  const nano = normalizeCharacterAppearance({
    race: "dwarf",
    beardStyle: "basic",
    beardColor: "pink",
    hairStyle: "relm_short",
    outfit: "none",
    upperOutfit: "none",
    lowerOutfit: "none"
  });
  assert.equal(nano.beardStyle, "winter");
  assert.ok(["black", "dark_brown", "chestnut", "blonde", "ginger", "white"].includes(nano.beardColor));

  const colors = new Set<string>();
  for (let seed = 1; seed <= 20; seed += 1) {
    let state = seed >>> 0;
    const appearance = generaAspettoCasuale("Nano", () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    }).characterAppearance!;
    assert.equal(appearance.beardStyle, "winter");
    colors.add(appearance.beardColor);
  }
  assert.ok(colors.size > 1, "la barba del Nano deve poter variare di colore");
  assert.ok(resolveCharacterLayers(nano, "idle").some((layer) => layer.layer === "beard" && layer.semanticId === "winter"));
});

test("agricoltore ha sempre l'annaffiatoio (Tools → Watering Can)", () => {
  const farmer = appearanceForPublicSpace(DEFAULT_CHARACTER_APPEARANCE, {
    isKing: false,
    nudismoAttivo: false,
    lavoro: "Agricoltore"
  });
  assert.equal(farmer.accessory, FARMER_TOOL);
  const idleLayers = resolveCharacterLayers(farmer, "idle").filter((layer) => layer.layer === "accessory");
  assert.ok(idleLayers.length >= 2, "annaffiatoio LPC ha sfondo e primo piano");
  assert.ok(idleLayers.every((layer) => layer.semanticId === FARMER_TOOL));
  const walkLayers = resolveCharacterLayers(farmer, "walk").filter((layer) => layer.layer === "accessory");
  assert.ok(walkLayers.length >= 2);
});

test("taglialegna ha sempre l'ascia (Tools → Axe)", () => {
  const lumberjack = appearanceForPublicSpace(DEFAULT_CHARACTER_APPEARANCE, {
    isKing: false,
    nudismoAttivo: false,
    lavoro: "Taglialegna"
  });
  assert.equal(lumberjack.accessory, LUMBERJACK_TOOL);
  const idleLayers = resolveCharacterLayers(lumberjack, "idle").filter((layer) => layer.layer === "accessory");
  assert.ok(idleLayers.length >= 1, "ascia LPC visibile in idle");
  assert.ok(idleLayers.every((layer) => layer.semanticId === LUMBERJACK_TOOL));
  const walkLayers = resolveCharacterLayers(lumberjack, "walk").filter((layer) => layer.layer === "accessory");
  assert.ok(walkLayers.length >= 1);
});

test("fabbro ha sempre il martello (Tools → Hammer)", () => {
  const fabbro = appearanceForPublicSpace(DEFAULT_CHARACTER_APPEARANCE, {
    isKing: false,
    nudismoAttivo: false,
    lavoro: "Fabbro"
  });
  assert.equal(fabbro.accessory, BLACKSMITH_TOOL);
  const idleLayers = resolveCharacterLayers(fabbro, "idle").filter((layer) => layer.layer === "accessory");
  assert.ok(idleLayers.length >= 1, "martello LPC visibile in idle");
  assert.ok(idleLayers.every((layer) => layer.semanticId === BLACKSMITH_TOOL));
});

test("minatore ha sempre il piccone (Tools → Pickaxe)", () => {
  const minatore = appearanceForPublicSpace(DEFAULT_CHARACTER_APPEARANCE, {
    isKing: false,
    nudismoAttivo: false,
    lavoro: "Minatore"
  });
  assert.equal(minatore.accessory, MINER_TOOL);
  const idleLayers = resolveCharacterLayers(minatore, "idle").filter((layer) => layer.layer === "accessory");
  assert.ok(idleLayers.length >= 1, "piccone LPC visibile in idle");
  assert.ok(idleLayers.every((layer) => layer.semanticId === MINER_TOOL));
});

test("medico ha sempre equip LPC (mail, cravat, mask, sunglasses, kimono)", () => {
  const doctor = appearanceForPublicSpace(DEFAULT_CHARACTER_APPEARANCE, {
    isKing: false,
    nudismoAttivo: false,
    lavoro: "Medico"
  });
  assert.equal(doctor.fullOutfit, "kimono");
  assert.equal(doctor.outfitPrimaryColor, "black");
  assert.equal(doctor.upperOutfit, "chainmail");
  assert.equal(doctor.outfitSecondaryColor, "iron");
  assert.equal(doctor.neckwear, "cravat");
  assert.equal(doctor.neckwearColor, "white");
  assert.equal(doctor.facialMask, "plain_mask");
  assert.equal(doctor.facialMaskColor, "white");
  assert.equal(doctor.facialEyes, "sunglasses");
  assert.equal(doctor.facialEyesColor, "black");
  assert.equal(doctor.hairStyle, "none");
  assert.equal(doctor.headwear, "mail");
  assert.equal(doctor.headwearColor, "iron");
  const idleLayers = resolveCharacterLayers(doctor, "idle");
  assert.ok(!idleLayers.some((layer) => layer.layer === "hairFront" || layer.layer === "hairBack"));
  assert.ok(idleLayers.some((layer) => layer.layer === "headwear" && layer.semanticId === "mail"));
  assert.ok(idleLayers.some((layer) => layer.layer === "fullOutfit" && layer.semanticId === "kimono"));
  assert.ok(idleLayers.some((layer) => layer.layer === "outfit" && layer.semanticId === "chainmail"));
  assert.ok(idleLayers.some((layer) => layer.layer === "neck" && layer.semanticId === "cravat"));
  assert.ok(idleLayers.some((layer) => layer.layer === "facialMask" && layer.semanticId === "plain_mask"));
  assert.ok(idleLayers.some((layer) => layer.layer === "facialEyes" && layer.semanticId === "sunglasses"));
});

test("giudice ha sempre capelli wavy bianchi e kimono nero", () => {
  const giudice = appearanceForPublicSpace(DEFAULT_CHARACTER_APPEARANCE, {
    isKing: false,
    nudismoAttivo: false,
    lavoro: "Giudice"
  });
  assert.equal(giudice.hairStyle, "wavy");
  assert.equal(giudice.hairColor, "white");
  assert.equal(giudice.beardStyle, "none");
  assert.equal(giudice.fullOutfit, "kimono");
  assert.equal(giudice.outfitPrimaryColor, "black");
  const idleLayers = resolveCharacterLayers(giudice, "idle");
  assert.ok(idleLayers.some((layer) => layer.layer === "hairFront" && layer.semanticId === "wavy"));
  assert.ok(idleLayers.some((layer) => layer.layer === "fullOutfit" && layer.semanticId === "kimono"));
});

test("mago ha sempre cappello magic celestial con colore stabile per seed", () => {
  const magoA = appearanceForPublicSpace(DEFAULT_CHARACTER_APPEARANCE, {
    isKing: false,
    nudismoAttivo: false,
    lavoro: "Mago",
    seed: 42
  });
  const magoB = appearanceForPublicSpace(DEFAULT_CHARACTER_APPEARANCE, {
    isKing: false,
    nudismoAttivo: false,
    lavoro: "Mago",
    seed: 42
  });
  const magoAlt = appearanceForPublicSpace(DEFAULT_CHARACTER_APPEARANCE, {
    isKing: false,
    nudismoAttivo: false,
    lavoro: "Mago",
    seed: 99
  });
  assert.equal(magoA.headwear, MAGO_HAT);
  assert.equal(magoB.headwearColor, magoA.headwearColor);
  assert.equal(magoAlt.headwear, MAGO_HAT);
  assert.ok(magoA.headwearColor);
  assert.equal(rendererKindFor(magoA, "idle"), "sprite");
  const idleLayers = resolveCharacterLayers(magoA, "idle");
  assert.ok(idleLayers.some((layer) => layer.layer === "headwear" && layer.semanticId === MAGO_HAT));
});

test("card Lavori Giudice usa sprite LPC e non il fallback legacy", () => {
  const esempio = generaAspettoEsempioOccupazione("Giudice", "giudice");
  assert.ok(esempio.characterAppearance);
  assert.equal(rendererKindFor(esempio.characterAppearance!, "idle"), "sprite");
  assert.equal(esempio.characterAppearance!.hairStyle, "wavy");
  assert.equal(esempio.characterAppearance!.hairColor, "white");
  assert.equal(esempio.characterAppearance!.fullOutfit, "kimono");
  assert.equal(esempio.characterAppearance!.outfitPrimaryColor, "black");
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

test("mantello cape e trim si sovrappongono", () => {
  const teen = normalizeCharacterAppearance({ bodyType: "teen", ageGroup: "teen", bodyFamily: "humanTeen", headStyle: "human_head" });
  const withCape = normalizeCharacterAppearance({ ...teen, cape: "solid", capeColor: "brown" });
  assert.equal(rendererKindFor(withCape, "idle"), "sprite");
  assert.ok(resolveCharacterLayers(withCape, "idle").some((layer) => layer.layer === "cape" && layer.semanticId === "solid"));

  const withTrim = normalizeCharacterAppearance({ ...teen, cape: "tattered", capeTrim: "trim", capeColor: "black" });
  const capeLayers = resolveCharacterLayers(withTrim, "idle").filter((layer) => layer.layer === "cape");
  assert.equal(capeLayers.length, 3);
  assert.ok(capeLayers.some((layer) => layer.semanticId === "tattered"));
  assert.ok(capeLayers.some((layer) => layer.semanticId === "trim"));
});

test("kimono trim si sovrappone alla base senza sostituirla", () => {
  const teen = normalizeCharacterAppearance({ bodyType: "teen", ageGroup: "teen", bodyFamily: "humanTeen", headStyle: "human_head" });
  const withTrim = normalizeCharacterAppearance({
    ...teen,
    fullOutfit: "kimono",
    fullOutfitTrim: "kimono_trim",
    outfitPrimaryColor: "brown"
  });
  const layers = resolveCharacterLayers(withTrim, "idle").filter((layer) => layer.layer === "fullOutfit");
  assert.equal(layers.length, 2);
  assert.equal(rendererKindFor(withTrim, "idle"), "sprite");

  const splitTrim = normalizeCharacterAppearance({
    ...teen,
    fullOutfit: "kimono_split",
    fullOutfitTrim: "kimono_split_trim",
    outfitPrimaryColor: "maroon"
  });
  assert.equal(resolveCharacterLayers(splitTrim, "idle").filter((layer) => layer.layer === "fullOutfit").length, 2);

  const invalidTrim = normalizeCharacterAppearance({
    ...teen,
    fullOutfit: "kimono",
    fullOutfitTrim: "kimono_split_trim"
  });
  assert.equal(invalidTrim.fullOutfitTrim, "none");

  const legacyTrimAsOutfit = normalizeCharacterAppearance({
    ...teen,
    fullOutfit: "kimono_trim",
    outfitPrimaryColor: "blue"
  });
  assert.equal(legacyTrimAsOutfit.fullOutfit, "kimono");
  assert.equal(legacyTrimAsOutfit.fullOutfitTrim, "kimono_trim");
});

test("CharacterAppearance round-trip mantiene ID semantici e nessun path/frame", () => {
  const serialized = serializeCharacterAppearance(DEFAULT_CHARACTER_APPEARANCE);
  const restored = deserializeCharacterAppearance(serialized);
  assert.deepEqual(restored, DEFAULT_CHARACTER_APPEARANCE);
  assert.doesNotMatch(serialized, /\.png|frameWidth|directionRows|spritePath/);
});
