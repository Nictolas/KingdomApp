import assert from "node:assert/strict";
import test from "node:test";
import {
 TERRITORY_SIDE,TERRITORY_CELLS,TERRITORY_BUILDINGS,CONQUEST_GOLD_COST,CONQUEST_WOOD_COST,
 advanceTerritoryDay,basicRoad,biomeForTerritory,buildAtFirstAvailable,canBuildAt,
 claimTerritory,createTerritoryWorld,groundAt,isTerritoryWorld,
 neighborCoordinates,territoryAction,territoryHousing,territoryKey,territoryPreview,
 tileAt,visitTerritory,worldMilitaryStrength,worldPopulation
} from "../src/game/territoryWorldModel";

const seed=123456789;
test("new world starts with exactly one 32×32 territory, not five; save is valid",()=>{
 const w=createTerritoryWorld(seed);
 assert.equal(w.seed,seed);
 assert.deepEqual(Object.keys(w.territories),["0,0"]);
 assert.equal(w.active,"0,0");
 assert.equal(TERRITORY_SIDE,32);assert.equal(TERRITORY_CELLS,1024);
 assert.equal(w.territories["0,0"].buildings.some(b=>b.kind==="castle"),true);
 assert.ok(territoryHousing(w.territories["0,0"])>=worldPopulation(w));
 assert.ok(isTerritoryWorld(w));
 assert.ok(isTerritoryWorld(JSON.parse(JSON.stringify(w))));
});

test("absolute coordinate generation is deterministic, different by seed and continuous at exits",()=>{
 const hashes=new Set();
 for(const key of [[0,0],[1,0],[0,-1],[-4,11],[82,-7]]){
   const [tx,ty]=key;
   const a=Array.from({length:1024},(_,i)=>groundAt(seed,tx,ty,i%32,Math.floor(i/32)));
   const b=Array.from({length:1024},(_,i)=>groundAt(seed,tx,ty,i%32,Math.floor(i/32)));
   assert.deepEqual(a,b);
   assert.equal(a.length,1024);
   hashes.add(a.join(""));
   for(const x of [15,16]){
     assert.ok(basicRoad(x,31));
     assert.equal(groundAt(seed,tx,ty,x,31),"road");
     assert.equal(groundAt(seed,tx,ty+1,x,0),"road");
   }
   for(const y of [15,16]){
     assert.equal(groundAt(seed,tx,ty,31,y),"road");
     assert.equal(groundAt(seed,tx+1,ty,0,y),"road");
   }
 }
 assert.ok(hashes.size>1,"Different tiles must not all have one terrain");
 assert.notDeepEqual(Array.from({length:1024},(_,i)=>groundAt(seed,3,5,i%32,Math.floor(i/32))),
   Array.from({length:1024},(_,i)=>groundAt(seed+1,3,5,i%32,Math.floor(i/32))));
 const biomes=new Set(Array.from({length:50},(_,i)=>biomeForTerritory(seed,i-20,5)));
 assert.ok(biomes.size>=4);
});

test("ownership requires adjacency, purchases cost gold, and acquired territory never rerolls",()=>{
 let w=createTerritoryWorld(seed);
 const unknown=claimTerritory(w,2,0,"purchase");
 assert.deepEqual(unknown.territories,w.territories);
 assert.match(unknown.notice,/confinante/);
 const peek=territoryPreview(w,1,0);
 assert.equal(peek.owned,false);
 assert.equal(peek.reachable,true);
 w=claimTerritory(w,1,0,"purchase");
 assert.equal(w.active,"1,0");
 assert.equal(w.gold,125-peek.cost);
 assert.equal(Object.keys(w.territories).length,2);
 assert.equal(w.territories["1,0"].biome,peek.biome);
 assert.ok(isTerritoryWorld(w));
 const returned=visitTerritory(w,"0,0");
 const revisited=visitTerritory(returned,"1,0");
 assert.deepEqual(revisited.territories["1,0"],w.territories["1,0"]);
 const again=claimTerritory(revisited,1,0,"purchase");
 assert.equal(again.gold,w.gold,"Already owned cannot charge twice");
});

test("expansion can grow beyond five territories with no 5-sector whitelist",()=>{
 let w=createTerritoryWorld(seed);
 for(let x=1;x<=9;x++){
   w={...w,gold:100000};
   const preview=territoryPreview(w,x,0);
   assert.ok(preview.reachable);
   w=claimTerritory(w,x,0,"purchase");
   assert.equal(w.active,territoryKey(x,0));
 }
 assert.equal(Object.keys(w.territories).length,10);
 assert.ok(isTerritoryWorld(w));
 assert.deepEqual(neighborCoordinates(9,0,"e"),{tx:10,ty:0,key:"10,0"});
});

test("conquest requires supplies and enough military force, deterministic defense",()=>{
 let w=createTerritoryWorld(seed);
 const target=territoryPreview(w,0,-1);
 const noResources=claimTerritory({...w,gold:0},0,-1,"conquest");
 assert.equal(Object.keys(noResources.territories).length,1);
 const startGold=w.gold,startWood=w.wood;
 // Barracks increase military strength, including those in offscreen claimed territories.
 while(worldMilitaryStrength(w)<target.defense){
   const next=buildAtFirstAvailable(w,"guard");
   assert.ok(next.nextBuilding>w.nextBuilding, "Room for a guard barracks");
   w=next;
 }
 const conquering=claimTerritory(w,0,-1,"conquest");
 assert.equal(conquering.active,"0,-1");
 assert.equal(conquering.wood,w.wood-CONQUEST_WOOD_COST);
 assert.equal(conquering.gold,w.gold-CONQUEST_GOLD_COST);
 assert.equal(conquering.territories["0,-1"].claim,"conquest");
 assert.ok(conquering.gold<=startGold&&conquering.wood<=startWood);
 assert.ok(isTerritoryWorld(conquering));
});

test("roads must connect, buildings must touch a road and avoid water/rocks/forests",()=>{
 let w=createTerritoryWorld(seed);
 let [roadx,roady]=[14,4];
 // Near the vertical backbone a new path is legal where grass is already clear.
 let adjacent:null|{x:number;y:number}=null;
 const t=w.territories["0,0"];
 for(let y=1;y<31&&!adjacent;y++){
   if(tileAt(w,t,14,y)==="grass"&&!t.residents.some(p=>p.x===14&&p.y===y))
     adjacent={x:14,y};
 }
 assert.ok(adjacent);
 const added=territoryAction(w,"road",adjacent!.x,adjacent!.y);
 assert.equal(added.wood,w.wood-1);
 assert.equal(tileAt(added,added.territories["0,0"],adjacent!.x,adjacent!.y),"road");
 assert.ok(isTerritoryWorld(added));
 w=added;
 const built=buildAtFirstAvailable(w,"house");
 assert.equal(built.nextBuilding,w.nextBuilding+1);
 assert.equal(built.gold,w.gold-TERRITORY_BUILDINGS.house.gold);
 assert.ok(isTerritoryWorld(built));
 const b=built.territories["0,0"].buildings.find(item=>item.id==="built-1")!;
 const removed=territoryAction(built,"demolish",b.x,b.y);
 assert.ok(!removed.territories["0,0"].buildings.some(item=>item.id==="built-1"));
 assert.equal(removed.wood,built.wood+2);
 assert.ok(isTerritoryWorld(removed));
});

test("disboscamento changes local tile only and is saved as delta; blocked tiles reject buildings",()=>{
 const w=createTerritoryWorld(seed);
 const near=claimTerritory(w,1,0,"purchase");
 const t=near.territories["1,0"];
 const target=Array.from({length:1024},(_,i)=>({x:i%32,y:Math.floor(i/32)}))
   .find(({x,y})=>groundAt(seed,1,0,x,y)==="woodland");
 if(target){
   const before=tileAt(near,t,target.x,target.y);
   const after=territoryAction(near,"clear",target.x,target.y);
   assert.equal(before,"woodland");
   assert.equal(tileAt(after,after.territories["1,0"],target.x,target.y),"grass");
   assert.equal(groundAt(seed,1,0,target.x,target.y),"woodland");
   assert.ok(isTerritoryWorld(after));
 }
 assert.equal(canBuildAt(near,t,15,15,"house"),false,"Roads are never building footprints");
 const out=territoryAction(near,"house",31,31);
 assert.equal(out.nextBuilding,near.nextBuilding);
});

test("offscreen territories continue production, resident births and movement",()=>{
 let w=createTerritoryWorld(seed);
 w=claimTerritory(w,1,0,"purchase");
 w={...w,wood:200,gold:200,food:120};
 w=buildAtFirstAvailable(w,"house");
 assert.ok(w.territories["1,0"].buildings.some(b=>b.kind==="house"));
 w=buildAtFirstAvailable(w,"farm");
 assert.ok(w.territories["1,0"].buildings.some(b=>b.kind==="farm"));
 w=visitTerritory(w,"0,0");
 const starting=worldPopulation(w),initialDay=w.day;
 const first=w.territories["0,0"].residents.map(p=>[p.x,p.y]);
 for(let i=0;i<7;i++){
   w=advanceTerritoryDay(w);
   assert.ok(isTerritoryWorld(w), "Save remains valid on simulated day "+w.day);
 }
 assert.equal(w.day,initialDay+7);
 assert.equal(w.active,"0,0");
 assert.ok(worldPopulation(w)>starting,"Housing should allow offscreen population to grow");
 assert.ok(w.territories["1,0"].residents.length>0);
 assert.notDeepEqual(w.territories["0,0"].residents.map(p=>[p.x,p.y]),first);
});

test("hostile or malformed saves cannot enter simulation",()=>{
 const base=createTerritoryWorld(seed);
 const clone=()=>JSON.parse(JSON.stringify(base));
 for(const modification of [
  (s:any)=>s.version=2,
  (s:any)=>s.active="5,9",
  (s:any)=>s.seed=-1,
  (s:any)=>s.gold=-1,
  (s:any)=>s.territories["0,0"].residents[0].x=99,
  (s:any)=>s.territories["0,0"].residents.push({...s.territories["0,0"].residents[0],id:"other"}),
  (s:any)=>s.territories["0,0"].roads=[1024],
  (s:any)=>s.territories["0,0"].buildings[1].x=s.territories["0,0"].buildings[0].x,
  (s:any)=>s.territories["5,0"]=s.territories["0,0"],
  (s:any)=>s.territories["0,0"].claim="conquest"
 ]){
  const bad=clone();modification(bad);assert.equal(isTerritoryWorld(bad),false);
 }
 assert.equal(isTerritoryWorld(base),true);
});
