import {SCHEDE_RAZZE} from "../src/game/razzeNavigazione.ts";
import {generaAspettoDaSeed,aspettoRenderizzabileAbitante} from "../src/game/personaggioAspetto.ts";
import {appearanceForPublicSpace} from "../src/character-system/appearance.ts";
import {resolveCharacterLayers,canRenderCharacter} from "../src/character-system/registry.ts";
import {writeFileSync} from "node:fs";
const info=SCHEDE_RAZZE.filter(x=>x.previewSeed!=null).map(x=>{
 const base=generaAspettoDaSeed(x.razza==="Golem"?"Umano":x.razza,x.previewSeed!,{sesso:"M"}).characterAppearance!;
 const a=aspettoRenderizzabileAbitante(appearanceForPublicSpace(base,{isKing:false,nudismoAttivo:false,razza:x.razza,sesso:"M",seed:x.previewSeed}));
 const layers=resolveCharacterLayers(a,"idle");
 if(!canRenderCharacter(a,"idle")||!layers.some(l=>l.layer==="body")||!layers.some(l=>l.layer==="raceFeatures"))throw new Error("Missing mandatory appearance "+x.razza);
 return {race:x.razza,bodyType:a.bodyType,layers:layers.map(l=>({layer:l.layer,sourceId:l.sourceId,zPos:l.zPos}))};
});
writeFileSync("scripts/.preview-layer-sources.json",JSON.stringify(info,null,2));
console.log(info.map(x=>[x.race,x.layers.length,x.bodyType]));
