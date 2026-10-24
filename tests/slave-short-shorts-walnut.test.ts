import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { aspettoSchiavo, aspettoPerVisualizzazioneAbitante, generaAspettoCasuale, creaCharacterAppearance } from "../src/game/personaggioAspetto.ts";
import { canRenderCharacter, LPC_RUNTIME_MANIFEST, resolveCharacterLayers } from "../src/character-system/registry.ts";
import { normalizeCharacterAppearance } from "../src/character-system/appearance.ts";

test("Short Shorts (Walnut): asset autentico LPC per tutte le corporature e animazioni", () => {
  const mapText=readFileSync("src/character-system/generated/lpcAssetSources.ts","utf8");
  const creditJSON=JSON.parse(readFileSync("src/character-system/generated/lpc-credits.json","utf8"));
  const attribution=creditJSON["b173cea57472"];
  assert.equal(attribution.definition,"legs/shorts/legs_shorts_short.json");
  assert.ok(attribution.credits.length>0);
  for(const bodyType of ["male","female","teen","child","muscular","pregnant"] as const){
    for(const animation of ["idle","walk"] as const){
      const assets=LPC_RUNTIME_MANIFEST.assets.filter(a=>a.bodyType===bodyType && a.animation===animation && a.semanticId==="short_shorts");
      assert.equal(assets.length,1,`${bodyType} ${animation}`);
      const asset=assets[0]!;
      assert.equal(asset.color,"walnut");
      assert.equal(asset.slot,"lowerBody");
      assert.equal(asset.attributionId,"b173cea57472");
      assert.ok(mapText.includes('"'+asset.sourceKey+'": require('));
      const png=readFileSync("assets/character-packs/lpc/generated/"+asset.sourceKey+".png");
      assert.equal(png.toString("hex",0,8),"89504e470d0a1a0a");
      assert.equal(png.readUInt32BE(16), animation==="idle" ? 128 : 576);
      assert.equal(png.readUInt32BE(20),256);
    }
  }
});

test("Tutti gli Schiavi: pelati, nessun altro indumento, solo short_shorts walnut", () => {
  for(const bodyType of ["male","female","teen","child","muscular","pregnant"] as const){
    const old=normalizeCharacterAppearance({
      ...creaCharacterAppearance(bodyType === "muscular" ? "Orco" : "Umano",bodyType),
      headwear:"none",footwear:"none",hairStyle:"none",upperOutfit:"none",lowerOutfit:"none",outfit:"none",fullOutfit:"none"
    });
    const slave=aspettoSchiavo(old);
    assert.equal(slave.hairStyle,"none");
    assert.equal(slave.beardStyle,"none");
    assert.equal(slave.lowerOutfit,"short_shorts");
    assert.equal(slave.outfitSecondaryColor,"walnut");
    for(const attr of ["upperOutfit","sleeveOutfit","fullOutfit","headwear","footwear","neckwear","facialMask","facialEyes","cape","capeTrim","accessory"] as const) assert.equal(slave[attr],"none",bodyType+" "+attr);
    for(const animation of ["idle","walk"] as const){
      assert.ok(canRenderCharacter(slave,animation),bodyType+" "+animation);
      const layers=resolveCharacterLayers(slave,animation);
      const clothes=layers.filter(x=>!["body","raceFeatures"].includes(x.layer));
      assert.equal(clothes.length,1,bodyType+" "+animation+": "+clothes.map(x=>x.layer).join(","));
      assert.equal(clothes[0]?.layer,"lowerBody");
      assert.equal(clothes[0]?.semanticId,"short_shorts");
      assert.ok(clothes[0]?.sourceId.includes("short_shorts_walnut"));
    }
  }
});

test("Schiavi preesistenti cambiano pantaloncini senza perdere i vestiti alla liberazione", () => {
  for (const race of ["Umano","Orco","Goblin"] as const) for (const sesso of ["M","F"] as const) {
    const saved=generaAspettoCasuale(race,()=>.6,{sesso,eta:27});
    const savedJSON=JSON.stringify(saved);
    const character={id:57,eta:27,razza:race,sesso,casta:"Schiavo" as const, lavoro:"Guardia",aspetto:saved};
    const displayed=aspettoPerVisualizzazioneAbitante(character)?.characterAppearance;
    assert.equal(displayed?.lowerOutfit,"short_shorts");
    assert.equal(displayed?.outfitSecondaryColor,"walnut");
    assert.equal(displayed?.hairStyle,"none");
    assert.equal(displayed?.upperOutfit,"none");
    assert.equal(JSON.stringify(saved),savedJSON);
    const free=aspettoPerVisualizzazioneAbitante({...character,casta:"Cittadino"})?.characterAppearance;
    assert.notEqual(free?.lowerOutfit,"short_shorts");
  }
});
