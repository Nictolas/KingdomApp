import assert from "node:assert/strict";
import test from "node:test";
import { OVERWORLD_SHEET_PX } from "../src/game/overworldSpritesheetLayout";
import { PREVIEW_COLS, PREVIEW_ROWS, isRoadCell } from "../src/game/sectorPreviewModel";
import {
  FARM_CROP_COORD, SHOP_CRATE_COORD, sectorBuildingAccent, sectorGroundCoord
} from "../src/game/sectorPlayableTerrain";

test("all 384 grass/path tiles use valid original atlas coordinates",()=>{
  let roads=0, grass=0;
  for(let y=0;y<PREVIEW_ROWS;y++)for(let x=0;x<PREVIEW_COLS;x++){
    const c=sectorGroundCoord(x,y);
    assert.ok(c.x>=0 && c.y>=0 && c.x+OVERWORLD_SHEET_PX.tile<=OVERWORLD_SHEET_PX.w &&
      c.y+OVERWORLD_SHEET_PX.tile<=OVERWORLD_SHEET_PX.h, `out of atlas: ${x},${y}`);
    assert.equal(c.x%64,0);
    assert.equal(c.y%64,0);
    if(isRoadCell(x,y)){
      roads++;
      assert.ok(c.x>=512&&c.x<=640&&c.y>=128&&c.y<=256,
        "No road may sample the original metallic prop at x=64 y=768");
    }else grass++;
  }
  assert.ok(roads>0&&grass>0);
  assert.equal(roads+grass,384);
});

test("wide two-cell roads use correct outside edges and interior corners",()=>{
  assert.deepEqual(sectorGroundCoord(7,5),{x:512,y:192},"west edge of N-S avenue");
  assert.deepEqual(sectorGroundCoord(8,5),{x:640,y:192},"east edge of N-S avenue");
  assert.deepEqual(sectorGroundCoord(2,11),{x:576,y:128},"north edge of W-E avenue");
  assert.deepEqual(sectorGroundCoord(2,12),{x:576,y:256},"south edge of W-E avenue");
  assert.deepEqual(sectorGroundCoord(7,11),{x:576,y:192},"four-way intersection");
  assert.deepEqual(sectorGroundCoord(0,11),{x:512,y:128},"top-left external border");
  assert.deepEqual(sectorGroundCoord(0,12),{x:512,y:256},"bottom-left external border");
});

test("farm crop and shop crate are distinct existing atlas sprites, independent of saves",()=>{
  assert.deepEqual(sectorBuildingAccent("farm"),FARM_CROP_COORD);
  assert.deepEqual(sectorBuildingAccent("shop"),SHOP_CRATE_COORD);
  assert.notDeepEqual(FARM_CROP_COORD,SHOP_CRATE_COORD);
  for(const name of ["castle","house","hut","unknown"])assert.equal(sectorBuildingAccent(name),null);
  for(const coord of [FARM_CROP_COORD,SHOP_CRATE_COORD]) {
    assert.ok(coord.x+64<=OVERWORLD_SHEET_PX.w&&coord.y+64<=OVERWORLD_SHEET_PX.h);
  }
});

test("invalid tile coordinate is never silently clamped to another cell",()=>{
  for(const [x,y] of [[-1,0],[0,24],[16,0],[1.5,1],[0,Infinity]]) {
    assert.throws(()=>sectorGroundCoord(x,y),RangeError);
  }
});
