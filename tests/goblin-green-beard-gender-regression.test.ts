import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeCharacterAppearance } from "../src/character-system/appearance.ts";
import { compatibleCatalogOptions, canRenderCharacter, resolveCharacterLayers } from "../src/character-system/registry.ts";
import {
  creaCharacterAppearance, generaAspettoCasuale, aspettoPerVisualizzazioneAbitante,
  aspettoSenzaBarbaDonna, normalizzaAspettoDonna
} from "../src/game/personaggioAspetto.ts";

test("I Goblin bambini, compresi quelli prima invisibili, hanno corpo e testa verdi renderizzabili", () => {
  for(const sesso of ["M", "F"] as const) {
    for(const eta of [5, 7, 15, 24, 42]) {
      for(const pick of [0, .25, .5, .75, .99]) {
        const old = generaAspettoCasuale("Goblin", () => pick, { eta, sesso });
        const out = aspettoPerVisualizzazioneAbitante({
          id: 441, sesso, eta, razza: "Goblin", aspetto: old, lavoro: "Disoccupato"
        })!;
        const a = out.characterAppearance!;
        assert.equal(a.race, "goblin");
        assert.equal(a.skinTone, "orc_green");
        assert.equal(out.colorePelle, "#39aa4e");
        for (const anim of ["idle","walk"] as const) {
          assert.ok(canRenderCharacter(a, anim), `${sesso} ${eta} ${pick} ${anim}`);
          const layers = resolveCharacterLayers(a, anim);
          assert.ok(layers.some(l => l.layer === "body" && l.sourceId.startsWith("lpc_orc_green_")));
          assert.ok(layers.some(l => l.layer === "raceFeatures" && l.semanticId === "goblin"));
        }
      }
    }
  }
});

test("Goblin con vecchio aspetto umano e capelli LPC incompatibili diventano verdi e visibili", () => {
  const old = generaAspettoCasuale("Umano", () => 0, { eta: 7, sesso: "M" });
  const original = JSON.stringify(old);
  const repaired = aspettoPerVisualizzazioneAbitante({ id: 124, eta: 7, sesso:"M", razza:"Goblin", aspetto:old })!;
  assert.equal(repaired.characterAppearance?.race, "goblin");
  assert.equal(repaired.characterAppearance?.skinTone, "orc_green");
  assert.equal(repaired.colorePelle, "#39aa4e");
  assert.ok(canRenderCharacter(repaired.characterAppearance!, "idle"));
  assert.ok(canRenderCharacter(repaired.characterAppearance!, "walk"));
  assert.equal(JSON.stringify(old), original);
});

test("Baffi e barbe disponibili e renderizzati sull'editor teen del Re", () => {
  const a=creaCharacterAppearance("Umano","teen");
  for (const style of ["mustache", "basic", "trimmed"]) {
    assert.ok(compatibleCatalogOptions(a).beardStyles.includes(style), style);
    const colors = [...new Set(["dark_brown","black","brown"])];
    const validColors = colors.filter(color =>
      resolveCharacterLayers(normalizeCharacterAppearance({ ...a, beardStyle: style, beardColor: color }), "idle").some(l => l.layer === "beard"));
    assert.ok(validColors.length > 0, style);
    for(const anim of ["idle","walk"] as const) {
      const layers=resolveCharacterLayers(normalizeCharacterAppearance({...a, beardStyle:style, beardColor:validColors[0] }),anim);
      assert.ok(layers.some(l => l.layer === "beard" && l.semanticId === style), anim+" "+style);
    }
  }
  const src=readFileSync("src/ui/CreazioneGiocatoreModal.tsx","utf8");
  assert.ok(src.includes('{ id: "beard", label: "Baffi e barba" }'));
  assert.ok(src.includes('activeTab === "beard"'));
  assert.ok(src.includes('if (g.id === "F") setAspetto'));
});

test("Donne adulte, bambine, anziane e nane non hanno mai barba, neanche da save precedente", () => {
  for (const race of ["Umano","Elfo","Nano","Orco","Goblin"] as const){
    for(const eta of [9, 16, 24, 71]) {
      const base=generaAspettoCasuale(race,()=>.62,{eta,sesso:"F"});
      assert.equal(base.characterAppearance?.beardStyle,"none",race+" generated");
      const old={...base,characterAppearance:{...base.characterAppearance!,beardStyle:"mustache",beardColor:"black"}};
      const normalized=normalizzaAspettoDonna(old,"F");
      assert.equal(normalized.characterAppearance?.beardStyle,"none");
      const displayed=aspettoPerVisualizzazioneAbitante({
        id:318,razza:race,eta,sesso:"F",aspetto:old,lavoro:"Guardia"
      })?.characterAppearance!;
      assert.equal(displayed.beardStyle,"none",race+" "+eta);
      for(const anim of ["idle","walk"] as const){
        assert.equal(resolveCharacterLayers(displayed,anim).some(x=>x.layer==="beard"),false);
      }
    }
  }
  const male=creaCharacterAppearance("Umano","teen");
  assert.equal(aspettoSenzaBarbaDonna({ ...male,beardStyle:"mustache" }, "M").beardStyle,"mustache");
  const invalid={...creaCharacterAppearance("Nano","child"),beardStyle:"none" as const};
  assert.equal(normalizeCharacterAppearance(invalid).beardStyle,"none","female dwarf must not be forced beard");
});
