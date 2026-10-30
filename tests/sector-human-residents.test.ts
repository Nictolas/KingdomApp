import assert from "node:assert/strict";
import test from "node:test";
import {canRenderCharacter} from "../src/character-system/registry";
import {stableResidentAnimation,stableResidentAppearance} from "../src/game/sectorResidentAppearance";
import {createPlayableKingdom} from "../src/game/sectorPlayableModel";
import {SECTOR_IDS} from "../src/game/sectorPreviewModel";
import {createTerritoryWorld} from "../src/game/territoryWorldModel";

test("all 110 existing sector citizens have real renderable human LPC sprites",()=>{
  const kingdom=createPlayableKingdom();
  const ids=SECTOR_IDS.flatMap(id=>kingdom.sectors[id].residents.map(p=>p.id));
  assert.equal(ids.length,110);
  const faces=new Set<string>();
  for(const id of ids){
    const a=stableResidentAppearance(id);
    assert.equal(a.race,"human","Never render rabbit art for "+id);
    assert.ok(canRenderCharacter(a,"idle"),"Missing LPC idle assets: "+id);
    assert.ok(canRenderCharacter(a,stableResidentAnimation(id)),"Missing LPC walk assets: "+id);
    assert.strictEqual(stableResidentAppearance(id),a,"Appearance must be stable across frames and days");
    faces.add([a.bodyType,a.skinTone,a.hairStyle,a.hairColor,a.beardStyle,a.outfit].join("|"));
  }
  assert.ok(faces.size>20,"Citizens should not all look like one repeated sprite");
});

test("32x32 world residents reuse the identical stable human LPC system",()=>{
  const world=createTerritoryWorld(445566);
  const residents=world.territories["0,0"].residents;
  assert.ok(residents.length>0);
  const faces=residents.map(p=>stableResidentAppearance(p.id));
  assert.ok(faces.every(a=>a.race==="human"&&canRenderCharacter(a,"idle")));
  assert.ok(new Set(faces.map(a=>a.hairStyle+"/"+a.skinTone+"/"+a.bodyType)).size>1);
  assert.equal(stableResidentAppearance(residents[0].id),faces[0]);
  assert.notStrictEqual(stableResidentAppearance(residents[0].id),stableResidentAppearance(residents[1].id));
});
