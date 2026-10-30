import assert from "node:assert/strict";
import test from "node:test";
import {
  SECTOR_IDS, SECTOR_SPECS, createSectorPreview, generateSectorPreviewWorld,
  neighborSector, isRoadCell, fitSquareGrid, hitTestSectorPreview, cycleSectorPreviewEntity,
  measureSectorPreviewViewport, sectorPreviewSelectionInfo
} from "../src/game/sectorPreviewModel";

test("fixed preview: five connected directions and no nonexistent neighbor",()=>{
  assert.equal(SECTOR_IDS.length,5);
  for(const [dir,sector] of Object.entries({n:"nord",s:"sud",w:"ovest",e:"est"}) as Array<[ "n"|"s"|"w"|"e", string]>) {
    assert.equal(neighborSector("centro",dir),sector);
    const inverse={n:"s",s:"n",e:"w",w:"e"} as const;
    assert.equal(neighborSector(sector as "nord"|"sud"|"est"|"ovest",inverse[dir]),"centro");
  }
  assert.equal(neighborSector("nord","n"),null);
});
test("16×24 sample has 15 houses, castle and 30 visible residents in center",()=>{
 const w=createSectorPreview("centro");
 assert.equal(w.cols,16);assert.equal(w.rows,24);
 assert.equal(w.buildings.filter(b=>b.kind==="house").length,15);
 assert.equal(w.buildings.filter(b=>b.kind==="castle").length,1);
 assert.equal(w.residents.length,30);
});
test("all sector previews preserve unique positions, borders and no road/building overlap",()=>{
 const world=generateSectorPreviewWorld();
 const allResidents=new Set<string>();
 for(const id of SECTOR_IDS){
   const w=world[id],occupied=new Set<number>();
   assert.equal(w.residents.length,SECTOR_SPECS[id].peopleCount);
   for(const b of w.buildings){
     assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=w.cols&&b.y+b.h<=w.rows);
     for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++){
       const cell=y*w.cols+x;
       assert.equal(occupied.has(cell),false,`overlapping buildings ${id} ${cell}`);
       assert.equal(isRoadCell(x,y,w.cols,w.rows),false,`building on road ${id} ${cell}`);
       occupied.add(cell);
     }
   }
   assert.deepEqual(occupied,w.occupied);
   const residentCells=new Set<number>();
   for(const p of w.residents){
     const cell=p.y*w.cols+p.x;
     assert.ok(p.x>=0&&p.x<w.cols&&p.y>=0&&p.y<w.rows);
     assert.ok(!occupied.has(cell),"resident spawned in building");
     assert.ok(!residentCells.has(cell),"residents spawned on same tile");
     residentCells.add(cell);
     assert.ok(!allResidents.has(p.id),"duplicate global preview resident id");allResidents.add(p.id);
   }
 }
 assert.equal(allResidents.size,110);
});
test("determinism: rebuilding sample does not move anything",()=>{
 const first=generateSectorPreviewWorld(),second=generateSectorPreviewWorld();
 for(const id of SECTOR_IDS){
   assert.deepEqual(first[id].buildings,second[id].buildings);
   assert.deepEqual(first[id].residents,second[id].residents);
 }
});
test("compact 14×21 comparison fits without deformation or offscreen objects",()=>{
 const world=generateSectorPreviewWorld(14,21);
 for(const id of SECTOR_IDS){
   assert.equal(world[id].cols,14);
   assert.equal(world[id].rows,21);
   assert.ok(world[id].buildings.length>0);
   assert.equal(world[id].residents.length,SECTOR_SPECS[id].peopleCount);
 }
 assert.equal(fitSquareGrid(420,672,16,24),26);
 assert.equal(fitSquareGrid(300,580,16,24),18);
 assert.equal(fitSquareGrid(0,100,16,24),0);
 assert.equal(fitSquareGrid(Infinity,100,16,24),0);
 assert.throws(()=>createSectorPreview("centro",4,8),/too small/);
});


test("hit testing prioritizes exact residents and buildings, supports nearby taps",()=>{
 const preview=createSectorPreview("centro"), size=12;
 const p=preview.residents[0];
 const exact=hitTestSectorPreview(preview,(p.x+.5)*size,(p.y+.5)*size,size);
 assert.deepEqual(exact,{id:p.id,name:p.name,kind:"resident"});
 const b=preview.buildings[0];
 const buildingHit=hitTestSectorPreview(preview,(b.x+.5)*size,(b.y+.5)*size,size);
 assert.deepEqual(buildingHit,{id:b.id,name:b.name,kind:"building"});
 // A tap just beyond a resident tile remains usable on a small display.
 const isolated={...preview,buildings:[],occupied:new Set<number>(),residents:[{id:"only",name:"Resident",x:3,y:3}]};
 const neighbor=hitTestSectorPreview(isolated,4.6*size,3.5*size,size);
 assert.deepEqual(neighbor,{id:"only",name:"Resident",kind:"resident"});
 assert.equal(hitTestSectorPreview(isolated,7.5*size,7.5*size,size),null);
 assert.equal(hitTestSectorPreview(isolated,4.6*size,3.5*size,size,0),null);
 assert.equal(hitTestSectorPreview(preview,-1,0,size),null);
 assert.equal(hitTestSectorPreview(preview,preview.cols*size,0,size),null);
 assert.equal(hitTestSectorPreview(preview,0,preview.rows*size,size),null);
 assert.equal(hitTestSectorPreview(preview,0,0,0),null);
 assert.equal(hitTestSectorPreview(preview,0,0,NaN),null);
 assert.equal(hitTestSectorPreview(preview,0,0,size,-1),null);
});

test("responsive square-grid geometry stays inside viewport at varied screen sizes",()=>{
 for(const [width,height] of [[280,300],[320,430],[375,600],[430,750],[768,960],[1024,640]]){
   const cell=fitSquareGrid(width-10,height-12,16,24);
   assert.ok(Number.isInteger(cell)&&cell>0);
   assert.ok(16*cell<=width-10);
   assert.ok(24*cell<=height-12);
   assert.equal(16*cell/cell,16);
   assert.equal(24*cell/cell,24);
 }
});

test("all sectors remain hit-testable with stable fixtures across repeated navigation",()=>{
 const world=generateSectorPreviewWorld();
 for(let cycle=0;cycle<150;cycle++){
   for(const id of SECTOR_IDS){
     const s=world[id];
     const first=s.residents[0];
     const hit=hitTestSectorPreview(s,(first.x+.5)*14,(first.y+.5)*14,14);
     assert.equal(hit?.id,first.id);
   }
 }
});


test("fallback selection cycles every building and resident in all five sectors, both directions",()=>{
  const world=generateSectorPreviewWorld();
  for(const id of SECTOR_IDS){
    const sector=world[id], total=sector.buildings.length+sector.residents.length;
    const seen=new Set<string>();
    let selected:string|null=null;
    for(let i=0;i<total;i++){
      const next=cycleSectorPreviewEntity(sector,selected,1);
      assert.ok(next);
      assert.ok(!seen.has(next.id),`duplicate selection ${id}: ${next.id}`);
      seen.add(next.id);
      selected=next.id;
    }
    assert.equal(seen.size,total);
    assert.equal(cycleSectorPreviewEntity(sector,selected,1)?.id,cycleSectorPreviewEntity(sector,null,1)?.id);
    const last=cycleSectorPreviewEntity(sector,null,-1);
    assert.equal(last?.id,selected);
    assert.equal(cycleSectorPreviewEntity(sector,last!.id,1)?.id,cycleSectorPreviewEntity(sector,null,1)?.id);
    assert.equal(cycleSectorPreviewEntity(sector,"stale-selection-from-other-sector",1)?.id,cycleSectorPreviewEntity(sector,null,1)?.id);
    assert.equal(cycleSectorPreviewEntity(sector,"stale-selection-from-other-sector",-1)?.id,last?.id);
    for(let i=0;i<total;i++){
      const back=cycleSectorPreviewEntity(sector,selected,-1);
      assert.ok(back);
      selected=back.id;
    }
    assert.equal(selected,last?.id);
  }
});

test("fallback selection handles empty sector and tiny square tiles without touching game state",()=>{
  const center=createSectorPreview("centro");
  assert.equal(cycleSectorPreviewEntity({...center,buildings:[],residents:[]},null,1),null);
  const first=cycleSectorPreviewEntity(center,null,1);
  assert.deepEqual(first,{id:center.buildings[0].id,name:center.buildings[0].name,kind:"building"});
  const last=cycleSectorPreviewEntity(center,null,-1);
  assert.deepEqual(last,{id:center.residents.at(-1)?.id,name:center.residents.at(-1)?.name,kind:"resident"});
  for(const size of [1,3,7,10,12,18]){
    const p=center.residents[0];
    assert.equal(hitTestSectorPreview(center,(p.x+.5)*size,(p.y+.5)*size,size)?.id,p.id);
    assert.equal(cycleSectorPreviewEntity(center,null,1)?.id,first?.id);
  }
});


test("actual safe-area map container: viewport classification preserves 16×24 squares",()=>{
  for(const [width,height,expected] of [
    [375,600,"readable"],[280,300,"compact"],[568,180,"tiny"],[0,200,"unavailable"]
  ] as const){
    const fit=measureSectorPreviewViewport(width,height);
    assert.equal(fit.legibility,expected);
    assert.equal(fit.gridWidth,fit.cell*16);
    assert.equal(fit.gridHeight,fit.cell*24);
    assert.ok(fit.gridWidth<=Math.max(0,width-10));
    assert.ok(fit.gridHeight<=Math.max(0,height-12));
  }
  assert.equal(measureSectorPreviewViewport(NaN,300).legibility,"unavailable");
  assert.equal(measureSectorPreviewViewport(320,Infinity).legibility,"unavailable");
});

test("selection metadata covers every entity and rejects stale IDs across all sectors",()=>{
  const world=generateSectorPreviewWorld();
  for(const id of SECTOR_IDS){
    const preview=world[id], total=preview.buildings.length+preview.residents.length;
    let selected:string|null=null;
    for(let index=1;index<=total;index++){
      const hit=cycleSectorPreviewEntity(preview,selected,1);
      assert.ok(hit);
      const info=sectorPreviewSelectionInfo(preview,hit.id);
      assert.equal(info?.index,index);
      assert.equal(info?.total,total);
      assert.equal(info?.kind,hit.kind);
      assert.ok(info!.x>=0&&info!.x<16&&info!.y>=0&&info!.y<24);
      selected=hit.id;
    }
    assert.equal(sectorPreviewSelectionInfo(preview,null),null);
    assert.equal(sectorPreviewSelectionInfo(preview,"other-sector-p-1"),null);
  }
});

test("neighbor tap recovery cannot jump multiple tiles on tiny landscape cells",()=>{
  const original=createSectorPreview("centro");
  const preview={...original,buildings:[],occupied:new Set<number>(),residents:[{id:"one",name:"One",x:3,y:3}]};
  const cell=4;
  assert.equal(hitTestSectorPreview(preview,3.5*cell+5,3.5*cell,cell)?.id,"one");
  assert.equal(hitTestSectorPreview(preview,3.5*cell+10,3.5*cell,cell),null);
  assert.equal(hitTestSectorPreview(preview,3.5*cell+5,3.5*cell,cell,0),null);
});
