import assert from "node:assert/strict";
import {naturalGeographyAt,regionalBiome,ridgeAt,riverAt} from "../src/game/territoryGeography";
import test from "node:test";
import {
 TERRITORY_SIDE,TERRITORY_CELLS,TERRITORY_BUILDINGS,CONQUEST_GOLD_COST,CONQUEST_WOOD_COST,
 advanceTerritoryDay,adjacentTerritoryTarget,basicRoad,biomeForTerritory,buildAtFirstAvailable,canBuildAt,
 claimTerritory,createTerritoryWorld,groundAt,isTerritoryWorld,
 neighborCoordinates,territoryAction,territoryHousing,territoryKey,territoryPreview,
 tileAt,visitTerritory,worldMilitaryStrength,worldPopulation
} from "../src/game/territoryWorldModel";

const seed=123456789;
test("new world starts with exactly one 32×32 territory, not five; save is valid",()=>{
 const w=createTerritoryWorld(seed);
 assert.equal(w.seed,seed);
 assert.equal(w.terrainVersion,2,"All newly created worlds use the improved generation, existing saves keep v1");
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
   .find(({x,y})=>groundAt(seed,1,0,x,y,t.biome,near.terrainVersion??1)==="woodland");
 if(target){
   const before=tileAt(near,t,target.x,target.y);
   const after=territoryAction(near,"clear",target.x,target.y);
   assert.equal(before,"woodland");
   assert.equal(tileAt(after,after.territories["1,0"],target.x,target.y),"grass");
   assert.equal(groundAt(seed,1,0,target.x,target.y,t.biome,near.terrainVersion??1),"woodland");
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

test("discovered territory uses the biome saved with it even if future fixed-landmark rules change",()=>{
  const base=createTerritoryWorld(seed);
  const oldBiomeWorld={
    ...base,
    territories:{
      ...base.territories,
      "0,0":{...base.territories["0,0"],biome:"foresta" as const}
    }
  };
  assert.ok(isTerritoryWorld(oldBiomeWorld));
  const cell=Array.from({length:1024},(_,i)=>({x:i%32,y:Math.floor(i/32)}))
    .find(({x,y})=>
      groundAt(seed,0,0,x,y,"foresta")!==groundAt(seed,0,0,x,y,"pianura"));
  assert.ok(cell);
  assert.equal(tileAt(oldBiomeWorld,oldBiomeWorld.territories["0,0"],cell!.x,cell!.y),
    groundAt(seed,0,0,cell!.x,cell!.y,"foresta"));
  assert.equal(base.territories["0,0"].biome,"pianura");
});

test("new world v2 has rivers and mountain ranges continuous across 32×32 boundaries",()=>{
  const s=987654321;
  let riverCrossings=0,ridgeCrossings=0;
  // Sample distinct borders across the landscape. Both sides use absolute
  // world coordinates, so no terrain feature can be arbitrarily reset at
  // the edge of a territory or depend on exploration order.
  for(let tx=-12;tx<=12;tx++){
    const left=(tx+1)*32-1,right=(tx+1)*32;
    let riverOnEdge=false,ridgeOnEdge=false;
    for(let y=-160;y<=160;y++){
      if(riverAt(s,left,y)&&riverAt(s,right,y))riverOnEdge=true;
      if(ridgeAt(s,left,y)&&ridgeAt(s,right,y))ridgeOnEdge=true;
    }
    if(riverOnEdge)riverCrossings++;
    if(ridgeOnEdge)ridgeCrossings++;
  }
  assert.ok(riverCrossings>=20,"Meandering rivers must cross many world sectors");
  assert.ok(ridgeCrossings>=5,"Mountains must form chains extending across sectors");

  for(let tx=-3;tx<=3;tx++)for(let ty=-3;ty<=3;ty++){
    const world=createTerritoryWorld(s);
    const biome=regionalBiome(s,tx,ty);
    const y=ty*32+7,x=(tx+1)*32-1;
    assert.equal(
      naturalGeographyAt(s,x,y,biome),
      naturalGeographyAt(s,x,y,biome),
      "New geography must be deterministic"
    );
    const sampled=Array.from({length:1024},(_,i)=>{
      const lx=i%32,ly=Math.floor(i/32);
      return groundAt(s,tx,ty,lx,ly,biome,2);
    });
    const again=Array.from({length:1024},(_,i)=>{
      const lx=i%32,ly=Math.floor(i/32);
      return groundAt(s,tx,ty,lx,ly,biome,2);
    });
    assert.deepEqual(sampled,again);
    assert.equal(sampled.length,1024);
    assert.equal(world.terrainVersion,2);
    for(const [lx,ly] of [[15,0],[16,31],[0,15],[31,16]]){
      assert.ok(["road","bridge"].includes(groundAt(s,tx,ty,lx,ly,biome,2)),
        "Roads and their bridges must remain passable at every sector boundary");
    }
  }
});

test("legacy saves with no terrainVersion preserve their old biomes and all 1024 tile types",()=>{
  const seed=99123;
  const newWorld=createTerritoryWorld(seed);
  const legacy={...newWorld,terrainVersion:undefined};
  assert.ok(isTerritoryWorld(legacy),"Previously saved world without version field remains readable");
  assert.equal(isTerritoryWorld({...newWorld,terrainVersion:3}),false);
  for(const [tx,ty] of [[0,0],[1,0],[-2,-3],[4,1]]){
    const oldBiome=biomeForTerritory(seed,tx,ty);
    for(let y=0;y<32;y++)for(let x=0;x<32;x++){
      const prior=groundAt(seed,tx,ty,x,y,oldBiome);
      const loaded=groundAt(seed,tx,ty,x,y,oldBiome,legacy.terrainVersion??1);
      assert.equal(loaded,prior,"An existing legacy world tile must never reroll");
    }
  }
  const t=legacy.territories["0,0"];
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    assert.equal(tileAt(legacy,t,x,y),groundAt(seed,0,0,x,y,t.biome),
      "The loaded original capital retains every prior terrain cell");
  }
});

test("new worlds stay valid after exploring forests, rivers, and extending roads",()=>{
  let world=createTerritoryWorld(987654321);
  world={...world,gold:500,wood:500};
  const destinations:[[number,number],[number,number],[number,number]]=[
    [1,0],[2,0],[2,1]
  ];
  for(const [x,y] of destinations){
    const before=territoryPreview(world,x,y);
    assert.ok(before.reachable);
    world=claimTerritory(world,x,y,"purchase");
    assert.equal(world.active,territoryKey(x,y));
    assert.ok(isTerritoryWorld(world));
    const previous=world.territories[world.active];
    const forest=Array.from({length:1024},(_,i)=>({x:i%32,y:Math.floor(i/32)}))
      .find(p=>tileAt(world,previous,p.x,p.y)==="woodland");
    if(forest){
      const next=territoryAction(world,"clear",forest.x,forest.y);
      assert.equal(tileAt(next,next.territories[next.active],forest.x,forest.y),"grass");
      assert.ok(isTerritoryWorld(next));
      world=next;
    }
  }
  assert.equal(world.terrainVersion,2);
  assert.equal(Object.keys(world.territories).length,4);
  const saved=JSON.parse(JSON.stringify(world));
  assert.ok(isTerritoryWorld(saved));
  assert.deepEqual(saved.territories,world.territories);
});

test("the overview remains safe at the world's supported coordinate edges",()=>{
  const world=createTerritoryWorld(23232);
  for(const [tx,ty] of [[4096,4096],[-4096,-4096],[4096,-4096],[-4096,4096]]){
    const preview=territoryPreview(world,tx,ty);
    assert.equal(preview.owned,false);
    assert.equal(preview.reachable,false);
    assert.equal(preview.tx,tx);
    assert.equal(preview.ty,ty);
  }
});

test("v2 bridges visually preserve natural waterways under the four main routes",()=>{
  const s=987654321;
  let bridges=0;
  for(let tx=-4;tx<=4;tx++)for(let ty=-4;ty<=4;ty++){
    const biome=biomeForTerritory(s,tx,ty,2);
    for(let y=0;y<32;y++)for(const x of [15,16]){
      const tile=groundAt(s,tx,ty,x,y,biome,2);
      const natural=naturalGeographyAt(s,tx*32+x,ty*32+y,biome);
      if(natural==="water"&&tile==="bridge")bridges++;
      if(natural==="water")assert.equal(tile,"bridge",
        "Rivers must remain visible as wooden bridges under the main north-south path");
    }
  }
  assert.ok(bridges>=10,"Expected bridges across several naturally occurring rivers");
});

test("the bridge tool connects roads across water, costs wood and survives saving",()=>{
  let found:{world:ReturnType<typeof createTerritoryWorld>;x:number;y:number}|null=null;
  for(let seed=1;seed<120&&!found;seed++){
    const world=createTerritoryWorld(seed);
    const territory=world.territories["0,0"];
    for(let y=1;y<31&&!found;y++)for(let x=1;x<31&&!found;x++){
      if(tileAt(world,territory,x,y)!=="water")continue;
      const neighbors=[[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
      if(neighbors.some(([xx,yy])=>["road","bridge"].includes(tileAt(world,territory,xx,yy)))){
        found={world,x,y};
      }
    }
  }
  assert.ok(found,"The main roads must reach a river bank in some seeded worlds");
  const {world,x,y}=found!;
  const before=world.wood;
  const after=territoryAction(world,"bridge",x,y);
  assert.equal(after.wood,before-3,"A crossing costs three units of wood");
  assert.equal(tileAt(after,after.territories["0,0"],x,y),"bridge");
  assert.ok(isTerritoryWorld(after),"Player-built bridges must persist through validation");
  assert.ok(isTerritoryWorld(JSON.parse(JSON.stringify(after))));
  assert.equal(territoryAction(after,"bridge",x,y).wood,after.wood,
    "Do not allow paying twice on an existing crossing");
  assert.equal(canBuildAt(after,after.territories["0,0"],x,y,"house"),false,
    "Buildings cannot occupy river bridges");
  const oldWorld={...world,terrainVersion:undefined};
  assert.ok(isTerritoryWorld(oldWorld),"Old saves do not require a terrain version");
  const oldBridge=territoryAction(oldWorld,"bridge",x,y);
  if(tileAt(oldWorld,oldWorld.territories["0,0"],x,y)==="water"){
    assert.equal(tileAt(oldBridge,oldBridge.territories["0,0"],x,y),"bridge");
    assert.ok(isTerritoryWorld(oldBridge),"Bridge construction must be safe on legacy maps");
  }
});

test("all four D-pad directions select the same frontier, with no automatic charges",()=>{
 let world=createTerritoryWorld(445522);
 const points=[["n",0,-1,"0,-1"],["s",0,1,"0,1"],["e",1,0,"1,0"],["w",-1,0,"-1,0"]] as const;
 const resources=[world.gold,world.wood,world.food];
 for(const [direction,tx,ty,key] of points){
  assert.deepEqual(adjacentTerritoryTarget(world,direction),{status:"frontier",direction,tx,ty,key});
  assert.deepEqual([world.gold,world.wood,world.food],resources);
 }
 for(const [direction,tx,ty,key] of points){
  world=claimTerritory({...world,gold:1000},tx,ty,"purchase");
  assert.equal(world.active,key);
  assert.ok(isTerritoryWorld(world));
  world=visitTerritory(world,"0,0");
  assert.deepEqual(adjacentTerritoryTarget(world,direction),{status:"owned",direction,tx,ty,key});
 }
 assert.equal(Object.keys(world.territories).length,5);
});

test("direction pad respects both positive and negative coordinate limits",()=>{
 const initial=createTerritoryWorld(85221);
 const distant={...initial.territories["0,0"],tx:4096,ty:-4096,
  claim:"purchase" as const,biome:biomeForTerritory(initial.seed,4096,-4096,2),
  buildings:[],residents:[],roads:[],cleared:[]};
 const world={...initial,active:"4096,-4096",territories:{...initial.territories,"4096,-4096":distant}};
 assert.ok(isTerritoryWorld(world));
 assert.deepEqual(adjacentTerritoryTarget(world,"e"),{status:"edge",direction:"e"});
 assert.deepEqual(adjacentTerritoryTarget(world,"n"),{status:"edge",direction:"n"});
 assert.deepEqual(adjacentTerritoryTarget(world,"s"),{status:"frontier",direction:"s",tx:4096,ty:-4095,key:"4096,-4095"});
 assert.deepEqual(adjacentTerritoryTarget(world,"w"),{status:"frontier",direction:"w",tx:4095,ty:-4096,key:"4095,-4096"});
});
