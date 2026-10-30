import assert from "node:assert/strict";
import test from "node:test";
import {
  SECTOR_IDS, SECTOR_SPECS, createSectorPreview, generateSectorPreviewWorld,
  neighborSector, isRoadCell, fitSquareGrid
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
