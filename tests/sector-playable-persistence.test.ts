import assert from "node:assert/strict";
import test from "node:test";
import { createPlayableKingdom, PLAYABLE_SAVE_KEY } from "../src/game/sectorPlayableModel";
import { createSectorSaveQueue, loadSectorKingdom } from "../src/game/sectorPlayablePersistence";

test("only isolated sector key is read and written, existing main game data is untouched",async()=>{
  const mainKey="mykingdom:main-save",mainValue="DO NOT MODIFY";
  const values=new Map([[mainKey,mainValue]]);
  const writes:string[]=[];
  const storage={
    async getItem(k:string){return values.get(k)??null;},
    async setItem(k:string,v:string){writes.push(k);values.set(k,v);}
  };
  const loaded=await loadSectorKingdom(storage);
  assert.equal(loaded.invalid,false);
  const queue=createSectorSaveQueue(storage);
  await queue.enqueue({...loaded.kingdom,day:4});
  await queue.flush();
  assert.deepEqual(writes,[PLAYABLE_SAVE_KEY]);
  assert.equal(values.get(mainKey),mainValue);
  assert.equal((await loadSectorKingdom(storage)).kingdom.day,4);
});

test("slow writes serialize and the newest day wins, even after a failed write",async()=>{
  let saved="";
  let calls=0;
  const storage={
    async getItem(){return saved||null;},
    async setItem(_key:string,value:string){
      calls++;
      if(calls===1)throw new Error("temporary failure");
      await new Promise(resolve=>setTimeout(resolve,calls===2?15:0));
      saved=value;
    }
  };
  const queue=createSectorSaveQueue(storage);
  const start=createPlayableKingdom();
  await assert.rejects(queue.enqueue(start));
  const second=queue.enqueue({...start,day:2});
  const third=queue.enqueue({...start,day:3});
  await Promise.all([second,third,queue.flush()]);
  assert.equal(JSON.parse(saved).day,3);
  assert.equal((await loadSectorKingdom(storage)).kingdom.day,3);
});

test("corrupt saved data is never overwritten by loading and requires explicit recovery",async()=>{
  const values=new Map([[PLAYABLE_SAVE_KEY,'{"version":1,"day":9999999999}']]);
  let writes=0;
  const storage={
    async getItem(k:string){return values.get(k)??null;},
    async setItem(k:string,v:string){writes++;values.set(k,v);}
  };
  const result=await loadSectorKingdom(storage);
  assert.equal(result.invalid,true);
  assert.equal(result.kingdom.day,1);
  assert.equal(writes,0);
  assert.equal(values.get(PLAYABLE_SAVE_KEY),'{"version":1,"day":9999999999}');
  const queue=createSectorSaveQueue(storage);
  await queue.enqueue(result.kingdom); // explicit confirmed reset, not implicit load
  assert.equal(writes,1);
});
