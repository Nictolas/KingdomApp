import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generaRegnoIniziale } from "../src/game/generazionePartita.ts";
import { creaCharacterAppearance,generaAspettoCasuale, aspettoPerVisualizzazioneAbitante, felixRenderizzabile } from "../src/game/personaggioAspetto.ts";
import { normalizeCharacterAppearance, FELIX_EAR_COLORS, FELIX_EAR_SKINTONES } from "../src/character-system/appearance.ts";
import { canRenderCharacter, resolveCharacterLayers, LPC_RUNTIME_MANIFEST } from "../src/character-system/registry.ts";
import type { ResolvedCharacterLayer } from "../src/character-system/types.ts";

test("ogni nuova partita, Avventura e Creativa, contiene sempre almeno un residente Felix", () => {
  for (const mode of ["creativa","avventura"] as const) for(let attempt=0;attempt<60;attempt++){
    const {abitanti}=generaRegnoIniziale(mode);
    const felix=abitanti.filter(a=>a.razza==="Felix");
    assert.equal(felix.length,1, mode+" "+attempt);
    assert.equal(abitanti[0]?.razza,"Umano");
    assert.ok(abitanti.every(a=>a.id===1 || a.lavoro!=="Consigliere" || a.razza==="Umano"));
    assert.ok(felix[0]?.id!==1);
    assert.ok(abitanti.some(a=>a.razza==="Golem")=== (mode==="creativa"));
    const sprite=aspettoPerVisualizzazioneAbitante(felix[0]!);
    assert.equal(sprite?.characterAppearance?.race,"felix");
    for (const anim of ["idle","walk"] as const) {
      assert.ok(canRenderCharacter(sprite!.characterAppearance!,anim),"generated "+mode+" "+attempt);
      const ears: ResolvedCharacterLayer[]=resolveCharacterLayers(sprite!.characterAppearance!,anim).filter(x=>x.layer==="ears");
      assert.equal(ears.filter(x=>x.semanticId==="cat_ears").length,2);
      assert.equal(ears.filter(x=>x.semanticId==="cat_ears_skintone").length,2);
    }
  }
});
test("Felix obbligatoriamente Cat Ears + Cat Ears Skintone, due colori casuali salvabili distinti", () => {
  const samples=new Set<string>();
  for(const v of [0,.2,.4,.6,.8,.99]){
    const a=generaAspettoCasuale("Felix",()=>v,{eta:22,sesso:"M"}).characterAppearance!;
    assert.equal(a.earsStyle,"cat_ears");
    assert.ok(FELIX_EAR_COLORS.includes(a.catEarsColor as typeof FELIX_EAR_COLORS[number]));
    assert.ok(FELIX_EAR_SKINTONES.includes(a.catEarsSkintoneColor as typeof FELIX_EAR_SKINTONES[number]));
    samples.add(a.catEarsColor+"|"+a.catEarsSkintoneColor);
  }
  assert.ok(samples.size>=3);
  for(const bodyType of ["male","female","teen","child","muscular","pregnant"] as const) {
    const a=felixRenderizzabile(normalizeCharacterAppearance({...creaCharacterAppearance("Felix",bodyType),bodyType,catEarsColor:"ginger",catEarsSkintoneColor:"brown",earsStyle:"none"}));
    assert.equal(a.earsStyle,"cat_ears");
    for(const animation of ["idle","walk"] as const){
      assert.ok(canRenderCharacter(a,animation),bodyType+" "+animation);
      const layers: ResolvedCharacterLayer[]=resolveCharacterLayers(a,animation);
      const ears=layers.filter(x=>x.layer==="ears");
      assert.equal(ears.length,4,bodyType+" "+animation);
      assert.equal(ears.filter(x=>x.semanticId==="cat_ears").length,2);
      assert.equal(ears.filter(x=>x.semanticId==="cat_ears_skintone").length,2);
      assert.ok(ears.filter(x=>x.semanticId==="cat_ears").every(x=>x.id.includes(":ginger:")));
      assert.ok(ears.filter(x=>x.semanticId==="cat_ears_skintone").every(x=>x.id.includes(":brown:")));
    }
  }
});
test("Felix non perde i due livelli cat ears tra professioni, pregna, vecchio aspetto e salvataggi",()=>{
  const old=generaAspettoCasuale("Umano",()=>.2,{eta:25,sesso:"F"});
  const a=aspettoPerVisualizzazioneAbitante({id:508,razza:"Felix",eta:25,sesso:"F",aspetto:old,lavoro:"Guardia",incinta:true})?.characterAppearance;
  assert.ok(a);
  assert.equal(a?.race,"felix");
  assert.equal(a?.earsStyle,"cat_ears");
  assert.equal(a?.beardStyle,"none");
  for (const anim of ["idle","walk"] as const){
    const layers: ResolvedCharacterLayer[]=resolveCharacterLayers(a!,anim).filter(x=>x.layer==="ears");
    assert.equal(layers.length,4);
  }
  assert.equal(old.characterAppearance?.race,"human");
});
test("I due asset sono realmente registrati, disponibili e accreditati nelle varianti idle/walk",()=>{
  const ts=readFileSync("src/character-system/generated/lpcAssetSources.ts","utf8");
  const credit=JSON.parse(readFileSync("src/character-system/generated/lpc-credits.json","utf8"));
  const all=LPC_RUNTIME_MANIFEST.assets.filter(x=>x.id.startsWith("felix_cat:"));
  assert.equal(all.length,192);
  for(const x of all) {
    assert.equal(x.slot,"ears");
    assert.ok(x.colorField==="catEarsColor" || x.colorField==="catEarsSkintoneColor");
    assert.ok(credit[x.attributionId]?.credits?.length>0);
    assert.ok(ts.includes('"'+x.sourceKey+'": require('));
    const png=readFileSync("assets/character-packs/lpc/generated/"+x.sourceKey+".png");
    assert.equal(png.toString("hex",0,8),"89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16),x.animation==="idle" ? 128 : 576);
    assert.equal(png.readUInt32BE(20),256);
  }
});
