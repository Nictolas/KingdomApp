import assert from "node:assert/strict";
import test from "node:test";
import { SECTOR_IDS, PREVIEW_COLS, PREVIEW_ROWS } from "../src/game/sectorPreviewModel";
import {
  advancePlayableDay, applySectorAction, buildAtAvailableSpot, COSTS, createPlayableKingdom,
  freeForBuilding, isPlayableKingdom, sectorAtCell, travelSector
} from "../src/game/sectorPlayableModel";

test("new independent sector game exposes a 16×24 playable five-zone kingdom",()=>{
 const g=createPlayableKingdom();
 assert.equal(g.version,1);
 assert.equal(g.day,1);
 assert.equal(g.sectors.centro.residents.length,30);
 assert.equal(g.sectors.centro.buildings.filter(b=>b.kind==="house").length,15);
 assert.equal(SECTOR_IDS.reduce((s,k)=>s+g.sectors[k].residents.length,0),110);
 assert.ok(isPlayableKingdom(JSON.parse(JSON.stringify(g))));
});
test("movement, production and food consumption progress in all five sectors even off screen",()=>{
 let g=createPlayableKingdom();
 const initial=g.sectors.nord.residents.map(p=>[p.x,p.y]);
 for(let i=0;i<7;i++)g=advancePlayableDay(g);
 assert.equal(g.day,8);
 assert.ok(g.gold>45,"shops should earn gold");
 assert.ok(g.wood>45,"forest should earn wood");
 assert.ok(g.food>100,"farms should produce food");
 assert.notDeepEqual(g.sectors.nord.residents.map(p=>[p.x,p.y]),initial);
 for(const id of SECTOR_IDS){
   const s=g.sectors[id],used=new Set<number>();
   for(const b of s.buildings)for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++)used.add(y*PREVIEW_COLS+x);
   for(const p of s.residents){
     assert.ok(p.x>=0&&p.x<PREVIEW_COLS&&p.y>=0&&p.y<PREVIEW_ROWS);
     const c=p.y*PREVIEW_COLS+p.x;
     assert.ok(!used.has(c),"inhabitant walked inside house");
     assert.ok(!used.has(c),id);
     used.add(c);
   }
 }
});
test("travel changes only visible sector, not global residents, inventory or day",()=>{
 const start=createPlayableKingdom(),moved=travelSector(start,"nord");
 assert.equal(moved.sector,"nord");assert.equal(start.sector,"centro");
 assert.equal(moved.day,start.day);assert.equal(moved.wood,start.wood);
 assert.deepEqual(moved.sectors.centro,start.sectors.centro);
});
test("build on empty terrain spends resources, creates selectable building, demolish refunds wood",()=>{
 const base=travelSector(createPlayableKingdom(),"sud");
 let available:null|{x:number;y:number}=null;
 for(let y=0;y<PREVIEW_ROWS-1&&!available;y++)for(let x=0;x<PREVIEW_COLS-1;x++)
  if(freeForBuilding(base.sectors.sud,x,y,"house")){available={x,y};break;}
 assert.ok(available,"sector must contain a buildable 2x2 footprint");
 const {x,y}=available!;
 const after=applySectorAction(base,"house",x,y);
 assert.equal(after.sectors.sud.buildings.length,base.sectors.sud.buildings.length+1);
 assert.equal(after.gold,base.gold-COSTS.house.gold);
 assert.equal(after.wood,base.wood-COSTS.house.wood);
 assert.equal(sectorAtCell(after.sectors.sud,x+1,y+1)?.builtByPlayer,true);
 const duplicate=applySectorAction(after,"farm",x,y);
 assert.equal(duplicate.sectors.sud.buildings.length,after.sectors.sud.buildings.length);
 const removed=applySectorAction(after,"demolish",x,y);
 assert.equal(removed.sectors.sud.buildings.length,base.sectors.sud.buildings.length);
 assert.equal(removed.wood,after.wood+2);
});
test("castle and preloaded buildings never demolished and invalid taps never mutate kingdom",()=>{
 const start=createPlayableKingdom();
 const castle=start.sectors.centro.buildings.find(b=>b.kind==="castle")!;
 const result=applySectorAction(start,"demolish",castle.x,castle.y);
 assert.equal(result.sectors.centro.buildings.length,start.sectors.centro.buildings.length);
 assert.equal(applySectorAction(start,"house",-1,99),start);
 assert.equal(applySectorAction(start,"shop",PREVIEW_COLS,0),start);
 assert.equal(freeForBuilding(start.sectors.centro,castle.x,castle.y,"house"),false);
});
test("building requires resources, rejects roads, and saved data rejects incompatible versions",()=>{
 let g=createPlayableKingdom();
 g={...g,wood:0,gold:0};
 let failed=applySectorAction(g,"house",0,0);
 assert.equal(failed.sectors.centro.buildings.length,g.sectors.centro.buildings.length);
 assert.match(failed.notice,/Risorse insufficienti/);
 const invalid=JSON.parse(JSON.stringify(g));invalid.version=2;
 assert.equal(isPlayableKingdom(invalid),false);
 const invalidCoords=JSON.parse(JSON.stringify(g));invalidCoords.sectors.centro.residents[0].x=1000;
 assert.equal(isPlayableKingdom(invalidCoords),false);
});


test("saved kingdom validation rejects overlapping buildings, duplicate residents and hostile resources",()=>{
  const base=createPlayableKingdom();
  const clone=()=>JSON.parse(JSON.stringify(base));
  const negative=clone(); negative.gold=-1;
  assert.equal(isPlayableKingdom(negative),false);
  const impossible=clone(); impossible.sectors.centro.residents[0].energy=NaN;
  assert.equal(isPlayableKingdom(impossible),false);
  const duplicate=clone(); duplicate.sectors.centro.residents[1].x=duplicate.sectors.centro.residents[0].x;
  duplicate.sectors.centro.residents[1].y=duplicate.sectors.centro.residents[0].y;
  assert.equal(isPlayableKingdom(duplicate),false);
  const overlap=clone(); overlap.sectors.centro.buildings.push({...overlap.sectors.centro.buildings[0],id:"fake"});
  assert.equal(isPlayableKingdom(overlap),false);
  const flood=clone(); flood.sectors.centro.residents=Array(10000).fill(flood.sectors.centro.residents[0]);
  assert.equal(isPlayableKingdom(flood),false);
  assert.equal(isPlayableKingdom(base),true);
});

test("one-tap placement finds a legal 2×2 spot without touching other sectors",()=>{
  const base=travelSector(createPlayableKingdom(),"sud");
  let target:null|{x:number;y:number}=null;
  for(let y=0;y<PREVIEW_ROWS-1&&!target;y++)
    for(let x=0;x<PREVIEW_COLS-1;x++)
      if(freeForBuilding(base.sectors.sud,x,y,"farm")){target={x,y};break;}
  assert.ok(target);
  const after=buildAtAvailableSpot(base,"farm");
  const built=after.sectors.sud.buildings.find(b=>b.id==="new-1");
  assert.ok(built);
  assert.deepEqual({x:built.x,y:built.y},target);
  assert.equal(built.kind,"farm");
  assert.equal(after.gold,base.gold-COSTS.farm.gold);
  assert.equal(after.wood,base.wood-COSTS.farm.wood);
  assert.deepEqual(after.sectors.centro,base.sectors.centro);
  assert.ok(isPlayableKingdom(after));
});

test("one-tap placement does not charge resources when unavailable",()=>{
  const base=createPlayableKingdom();
  const poor={...base,gold:0};
  const rejected=buildAtAvailableSpot(poor,"shop");
  assert.equal(rejected.gold,0);
  assert.deepEqual(rejected.sectors,poor.sectors);
  assert.match(rejected.notice,/Risorse insufficienti/);
  // A fully occupied synthetic sector cannot accept a 2×2 building.
  const residents=Array.from({length:PREVIEW_COLS*PREVIEW_ROWS},(_,i)=>({
    id:"blocked-"+i,name:"Test",x:i%PREVIEW_COLS,y:Math.floor(i/PREVIEW_COLS),energy:100
  }));
  const filled={...base,sectors:{...base.sectors,centro:{...base.sectors.centro,residents}}};
  const noSpace=buildAtAvailableSpot(filled,"house");
  assert.match(noSpace.notice,/Non ci sono aree/);
  assert.equal(noSpace.gold,base.gold);
  assert.equal(noSpace.wood,base.wood);
});
