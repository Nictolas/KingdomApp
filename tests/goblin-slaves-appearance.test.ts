import assert from "node:assert/strict";
import test from "node:test";
import { creaCharacterAppearance } from "../src/game/personaggioAspetto.ts";
import { aspettoPerVisualizzazioneAbitante, generaAspettoCasuale, normalizzaAspettoGoblin, aspettoSchiavo } from "../src/game/personaggioAspetto.ts";
import { normalizeCharacterAppearance } from "../src/character-system/appearance.ts";
import { compatibleCatalogOptions, resolveCharacterLayers } from "../src/character-system/registry.ts";

test("ogni Goblin ha corpo verde, viso Goblin e sprite LPC da fermo e in cammino", () => {
  for (const bodyType of ["male", "female", "teen", "child", "pregnant", "muscular"] as const) {
    const a = normalizeCharacterAppearance({ ...creaCharacterAppearance("Goblin"), bodyType, skinTone: "light", hairStyle: "none", upperOutfit: "none", lowerOutfit: "none", outfit: "none" });
    assert.equal(a.skinTone, "orc_green");
    assert.equal(a.headStyle, "goblin");
    assert.deepEqual(compatibleCatalogOptions(a).skinTones, ["orc_green"]);
    for (const animation of ["idle", "walk"] as const) {
      const layers = resolveCharacterLayers(a, animation);
      assert.ok(layers.some(x => x.layer === "body" && x.sourceId.startsWith("lpc_orc_green_")), bodyType);
      assert.ok(layers.some(x => x.layer === "raceFeatures" && x.semanticId === "goblin"), bodyType);
    }
  }
});
test("Goblin vecchi salvataggi e nuova generazione sono verdi senza alterare vestiti", () => {
  for (const seed of [0, 0.5, 0.99]) {
    const a = generaAspettoCasuale("Goblin", () => seed);
    assert.equal(a.colorePelle, "#39aa4e");
  }
  const legacy = generaAspettoCasuale("Umano", () => 0.5);
  const restored = normalizzaAspettoGoblin(legacy);
  assert.equal(restored.characterAppearance?.skinTone, "orc_green");
  assert.equal(restored.characterAppearance?.race, "goblin");
  assert.equal(restored.characterAppearance?.upperOutfit, legacy.characterAppearance?.upperOutfit);
  assert.deepEqual(normalizzaAspettoGoblin(restored), restored);
});
test("la casta Schiavo non ha capelli, barba o abiti diversi da Short Shorts (Walnut)", () => {
  for (const race of ["Umano", "Orco", "Goblin"] as const) {
    for (const sex of ["M", "F"] as const) {
      const old = generaAspettoCasuale(race, () => 0.4, { sesso: sex, eta: 29 });
      const view = aspettoPerVisualizzazioneAbitante({ id: 55, eta: 29, sesso: sex, razza: race, casta: "Schiavo", lavoro: "Guardia", aspetto: old })!;
      const a = view.characterAppearance!;
      assert.equal(a.hairStyle, "none");
      for (const k of ["beardStyle","upperOutfit","sleeveOutfit","fullOutfit","footwear","headwear","neckwear","facialMask","facialEyes","cape","accessory"] as const) assert.equal(a[k], "none", k);
      assert.equal(a.lowerOutfit, "short_shorts");
      for (const animation of ["idle","walk"] as const) {
        const layers = resolveCharacterLayers(a, animation);
        assert.ok(layers.some(x => x.layer === "lowerBody" && x.semanticId === "short_shorts"));
        assert.ok(!layers.some(x => ["outfit","hairFront","hairBack","beard","footwear","headwear","cape"].includes(x.layer)));
      }
      assert.notEqual(old.characterAppearance?.lowerOutfit, "short_shorts");
    }
  }
});
test("la regola Schiavo cessa per i personaggi liberati", () => {
  const old = generaAspettoCasuale("Umano", () => 0.6);
  const slave = aspettoSchiavo(old.characterAppearance!);
  assert.equal(slave.lowerOutfit, "short_shorts");
  const free = aspettoPerVisualizzazioneAbitante({ id: 55, razza: "Umano", casta: "Cittadino", aspetto: old });
  assert.notEqual(free?.characterAppearance?.lowerOutfit, "short_shorts");
});
