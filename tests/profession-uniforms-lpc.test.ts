import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CHARACTER_APPEARANCE,
  appearanceForPublicSpace,
  GUARD_CHAINMAIL_OUTFIT,
  isGuardChainmailOutfit
} from "../src/character-system/appearance.ts";
import { LPC_RUNTIME_MANIFEST, resolveCharacterLayers } from "../src/character-system/registry.ts";

const base = DEFAULT_CHARACTER_APPEARANCE;
const visual = (lavoro: string) =>
  appearanceForPublicSpace(base, { isKing: false, nudismoAttivo: false, lavoro, razza: "Umano", sesso: "M", seed: 5 });

test("Agricoltore, Taglialegna, Fabbro e Minatore indossano capi LPC presenti nel manifest", () => {
  const professions = [
    { lavoro: "Agricoltore", upper: "farmer", lower: "farmer", accessory: "watering_can" },
    { lavoro: "Taglialegna", upper: "traveler", lower: "traveler", accessory: "axe" },
    { lavoro: "Fabbro", upper: "farmer", lower: "farmer", accessory: "hammer" },
    { lavoro: "Minatore", upper: "commoner", lower: "commoner", accessory: "pickaxe" }
  ] as const;

  for (const expected of professions) {
    const appearance = visual(expected.lavoro);
    assert.equal(appearance.upperOutfit, expected.upper, expected.lavoro);
    assert.equal(appearance.lowerOutfit, expected.lower, expected.lavoro);
    assert.ok(!isGuardChainmailOutfit(appearance.upperOutfit), expected.lavoro);
    for (const animation of ["idle", "walk"] as const) {
      const layers = resolveCharacterLayers(appearance, animation);
      assert.ok(layers.some((layer) => layer.layer === "outfit" && layer.semanticId === expected.upper),
        `${expected.lavoro}/${animation}: busto`);
      assert.ok(layers.some((layer) => layer.layer === "lowerBody" && layer.semanticId === expected.lower),
        `${expected.lavoro}/${animation}: pantaloni`);
    }
    if (expected.lavoro === "Agricoltore") {
      assert.ok(resolveCharacterLayers(appearance, "walk").some((layer) =>
        layer.layer === "accessory" && layer.semanticId === expected.accessory));
    }
    // Gli altri tre attrezzi non sono ancora stati importati: non vanno
    // dichiarati visibili finché non compaiono nel manifest.
    if (expected.lavoro !== "Agricoltore") {
      assert.equal(LPC_RUNTIME_MANIFEST.assets.some((asset) => asset.slot === "accessory" &&
        asset.semanticId === expected.accessory), false);
    }
  }
});

test("Medico e Giudice portano vesti distinguibili; il Mago ha la veste viola", () => {
  const medico = visual("Medico");
  const giudice = visual("Giudice");
  const mago = visual("Mago");
  assert.equal(medico.fullOutfit, "kimono");
  assert.equal(medico.outfitPrimaryColor, "white");
  assert.equal(giudice.fullOutfit, "kimono");
  assert.equal(giudice.outfitPrimaryColor, "black");
  assert.equal(mago.fullOutfit, "kimono");
  assert.equal(mago.outfitPrimaryColor, "purple");
  assert.equal(mago.headwear, "none", "non usare cappello inesistente");
  for (const [role, appearance] of [["Medico", medico], ["Giudice", giudice], ["Mago", mago]] as const) {
    assert.ok(resolveCharacterLayers(appearance, "idle").some((layer) =>
      layer.layer === "fullOutfit" && layer.semanticId === "kimono"), role);
    assert.ok(resolveCharacterLayers(appearance, "walk").some((layer) =>
      layer.layer === "fullOutfit" && layer.semanticId === "kimono"), role);
  }
});

test("la Guardia ha cotta di maglia e pantaloni militari, solo durante il servizio", () => {
  const guard = visual("Guardia");
  assert.equal(guard.upperOutfit, GUARD_CHAINMAIL_OUTFIT);
  assert.equal(guard.lowerOutfit, GUARD_CHAINMAIL_OUTFIT);
  assert.equal(guard.outfitSecondaryColor, "black");
  assert.ok(resolveCharacterLayers(guard, "walk").some((layer) =>
    layer.layer === "outfit" && layer.id.startsWith("guard_chainmail")));
  assert.ok(resolveCharacterLayers(guard, "walk").some((layer) =>
    layer.layer === "lowerBody" && layer.semanticId === "guard"));
  assert.deepEqual(base, DEFAULT_CHARACTER_APPEARANCE);
  const formerGuard = visual("Disoccupato");
  assert.equal(isGuardChainmailOutfit(formerGuard.upperOutfit), false);
  assert.equal(isGuardChainmailOutfit(formerGuard.lowerOutfit), false);
});

test("i completi non cambiano l'aspetto personale persistito", () => {
  const original = { ...DEFAULT_CHARACTER_APPEARANCE, outfitPrimaryColor: "pink", upperOutfit: "traveler" };
  const before = { ...original };
  for (const profession of ["Agricoltore", "Taglialegna", "Fabbro", "Minatore", "Medico", "Giudice", "Mago", "Guardia"]) {
    appearanceForPublicSpace(original, { isKing: false, nudismoAttivo: false, lavoro: profession });
    assert.deepEqual(original, before);
  }
});
