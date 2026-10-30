import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CHARACTER_APPEARANCE, normalizeCharacterAppearance } from "../src/character-system/appearance";
import {
  applyProfessionUniform, clearProfessionUniform, defaultProfessionUniform, extractProfessionUniform,
  getProfessionUniforms, loadProfessionUniforms, PROFESSION_OUTFITS_KEY,
  PROFESSION_ROLES, parseProfessionUniforms, professionRoleForWork,
  resetProfessionUniformCacheForTests, saveProfessionUniform, saveProfessionUniforms
} from "../src/game/professionOutfitTemplates";

function memoryStore(){
  const m=new Map<string,string>();
  const calls:string[]=[];
  return {
    m,calls,
    async getItem(key:string){calls.push("get:"+key);return m.get(key)??null;},
    async setItem(key:string,v:string){calls.push("set:"+key);m.set(key,v);}
  };
}

test("all profession IDs unique and work aliases resolve, including king priority",()=>{
  assert.equal(new Set(PROFESSION_ROLES.map(x=>x.id)).size,PROFESSION_ROLES.length);
  assert.equal(professionRoleForWork("Agricoltore"),"agricoltore");
  assert.equal(professionRoleForWork("Contadino"),"agricoltore");
  assert.equal(professionRoleForWork("Taglialegna"),"taglialegna");
  assert.equal(professionRoleForWork("Capo Religioso"),"sacerdote");
  assert.equal(professionRoleForWork("Mercante"),"mercante");
  assert.equal(professionRoleForWork("qualcosa"),null);
  assert.equal(professionRoleForWork("Agricoltore",true),"re");
});

test("uniforms store garments only, never hair, skin, body, eyes, face or game saves",async()=>{
  resetProfessionUniformCacheForTests();
  const storage=memoryStore();
  storage.m.set("mykingdom.save.primary","PRIVATE SAVE SENTINEL");
  storage.m.set("mykingdom:sectors:playable:v1","SECTOR SAVE SENTINEL");
  const alice=normalizeCharacterAppearance({...DEFAULT_CHARACTER_APPEARANCE,
    hairStyle:"messy",hairColor:"dark_brown",beardStyle:"none",skinTone:"light"});
  const bob=normalizeCharacterAppearance({...alice,hairStyle:"wavy",hairColor:"white",
    beardStyle:"winter",beardColor:"white",skinTone:"dark"});
  const uniform=extractProfessionUniform(alice);
  assert.ok(!Object.hasOwn(uniform,"hairStyle") && !Object.hasOwn(uniform,"skinTone"));
  await saveProfessionUniform(storage,"agricoltore",uniform);
  assert.deepEqual(storage.calls.filter(x=>x.startsWith("set:")),["set:"+PROFESSION_OUTFITS_KEY]);
  assert.equal(storage.m.get("mykingdom.save.primary"),"PRIVATE SAVE SENTINEL");
  assert.equal(storage.m.get("mykingdom:sectors:playable:v1"),"SECTOR SAVE SENTINEL");
  const aliceStyled=applyProfessionUniform(alice,"Agricoltore");
  const bobStyled=applyProfessionUniform(bob,"Agricoltore");
  assert.equal(aliceStyled.hairStyle,alice.hairStyle);
  assert.equal(bobStyled.hairStyle,bob.hairStyle);
  assert.equal(aliceStyled.hairColor,alice.hairColor);
  assert.equal(bobStyled.hairColor,bob.hairColor);
  assert.equal(bobStyled.skinTone,bob.skinTone);
  assert.equal(bobStyled.beardStyle,bob.beardStyle);
  assert.equal(bobStyled.beardColor,bob.beardColor);
  assert.equal(aliceStyled.upperOutfit,bobStyled.upperOutfit);
  assert.equal(aliceStyled.lowerOutfit,bobStyled.lowerOutfit);
});

test("editor preferences persist independently across game launches and reset per role",async()=>{
  resetProfessionUniformCacheForTests();
  const storage=memoryStore();
  const base=extractProfessionUniform(DEFAULT_CHARACTER_APPEARANCE);
  await saveProfessionUniform(storage,"medico",base);
  await saveProfessionUniform(storage,"guardia",{...base,headwear:"none"});
  resetProfessionUniformCacheForTests();
  const reload=await loadProfessionUniforms(storage);
  assert.ok(reload.medico);
  assert.ok(reload.guardia);
  await clearProfessionUniform(storage,"medico");
  assert.ok(!getProfessionUniforms().medico);
  assert.ok(getProfessionUniforms().guardia);
  assert.ok(!parseProfessionUniforms(storage.m.get(PROFESSION_OUTFITS_KEY)!).medico);
});

test("unknown or malformed versions/fields are rejected before any write",async()=>{
  resetProfessionUniformCacheForTests();
  const storage=memoryStore();
  const base=extractProfessionUniform(DEFAULT_CHARACTER_APPEARANCE);
  for(const raw of [
    "broken",
    JSON.stringify({version:2,uniforms:{}}),
    JSON.stringify({version:1,uniforms:{nascosto:base}}),
    JSON.stringify({version:1,uniforms:{guardia:{...base,hairStyle:"override"}}}),
    JSON.stringify({version:1,uniforms:{guardia:{...base,upperOutfit:"".padEnd(81,"x")}}}),
    JSON.stringify({version:1,uniforms:{guardia:{upperOutfit:"commoner"}}})
  ])assert.throws(()=>parseProfessionUniforms(raw));
  await assert.rejects(saveProfessionUniforms(storage,{guardia:{...base,hairStyle:"mutated"} as never}));
  assert.equal(storage.calls.filter(x=>x.startsWith("set:")).length,0);
});

test("invalid stored preferences are not silently overwritten, and nudism bypasses garments",async()=>{
  resetProfessionUniformCacheForTests();
  const storage=memoryStore();
  storage.m.set(PROFESSION_OUTFITS_KEY,"{broken");
  await assert.rejects(loadProfessionUniforms(storage));
  assert.equal(storage.calls.filter(x=>x.startsWith("set:")).length,0);
  const base=DEFAULT_CHARACTER_APPEARANCE;
  const uniform=extractProfessionUniform(base);
  assert.strictEqual(applyProfessionUniform(base,"Agricoltore",{override:uniform,nudismoAttivo:true}),base);
  assert.strictEqual(applyProfessionUniform(base,"Non esiste"),base);
});

test("starter profession outfit looks consistent on independent faces and hair",()=>{
  resetProfessionUniformCacheForTests();
  const base=normalizeCharacterAppearance(DEFAULT_CHARACTER_APPEARANCE);
  const personA=normalizeCharacterAppearance({...base,hairStyle:"messy",hairColor:"dark_brown",beardStyle:"none"});
  const personB=normalizeCharacterAppearance({...base,hairStyle:"wavy",hairColor:"white",beardStyle:"winter",beardColor:"white",skinTone:"dark"});
  for(const id of ["agricoltore","taglialegna","minatore","fabbro","mercante","artigiano","edile","sacerdote","nobile"] as const){
    const role=PROFESSION_ROLES.find(x=>x.id===id)!;
    const uniform=defaultProfessionUniform(id);
    const appearanceA=applyProfessionUniform(personA,role.lavoro,{override:uniform});
    const appearanceB=applyProfessionUniform(personB,role.lavoro,{override:uniform});
    assert.equal(appearanceA.hairStyle,personA.hairStyle);
    assert.equal(appearanceB.hairStyle,personB.hairStyle);
    assert.equal(appearanceA.skinTone,personA.skinTone);
    assert.equal(appearanceB.skinTone,personB.skinTone);
    assert.equal(appearanceA.beardStyle,personA.beardStyle);
    assert.equal(appearanceB.beardStyle,personB.beardStyle);
    assert.deepEqual(extractProfessionUniform(appearanceA),extractProfessionUniform(appearanceB),
      "Profession "+id+" must not choose random clothes for each citizen");
  }
});
