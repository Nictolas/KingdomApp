import assert from "node:assert/strict";
import test from "node:test";
import { claimTerritory, createTerritoryWorld,TERRITORY_SAVE_KEY } from "../src/game/territoryWorldModel";
import {createTerritoryWriteQueue,loadTerritoryWorld} from "../src/game/territoryWorldPersistence";

function memory(){
 const files=new Map<string,string>();
 const calls:string[]=[];
 return {
   files,calls,
   async getItem(key:string){calls.push("get:"+key);return files.get(key)??null;},
   async setItem(key:string,value:string){calls.push("set:"+key);files.set(key,value);}
 };
}
test("versioned territory save is fully isolated from Adventure, Creative, old sectors and uniforms",async()=>{
 const storage=memory();
 storage.files.set("mykingdom.save.main","MAIN SAVE");
 storage.files.set("mykingdom:sectors:playable:v1","SECTORS SAVE");
 storage.files.set("mykingdom:profession-outfits:v1","OUTFITS SAVE");
 const queue=createTerritoryWriteQueue(storage);
 let world=createTerritoryWorld(42);
 world=claimTerritory(world,1,0,"purchase");
 await queue.enqueue(world);
 await queue.flush();
 assert.deepEqual(storage.calls.filter(c=>c.startsWith("set:")),["set:"+TERRITORY_SAVE_KEY]);
 assert.equal(storage.files.get("mykingdom.save.main"),"MAIN SAVE");
 assert.equal(storage.files.get("mykingdom:sectors:playable:v1"),"SECTORS SAVE");
 assert.equal(storage.files.get("mykingdom:profession-outfits:v1"),"OUTFITS SAVE");
 const load=await loadTerritoryWorld(storage);
 assert.equal(load.invalid,false);
 assert.equal(load.world.active,"1,0");
 assert.equal(Object.keys(load.world.territories).length,2);
 assert.deepEqual(load.world,world);
});
test("malformed territory save is preserved verbatim, and only reset by explicit user overwrite",async()=>{
 const storage=memory();
 const original="{corrupted binary contents";
 storage.files.set(TERRITORY_SAVE_KEY,original);
 const result=await loadTerritoryWorld(storage);
 assert.equal(result.invalid,true);
 assert.equal(storage.files.get(TERRITORY_SAVE_KEY),original);
 assert.equal(storage.calls.filter(x=>x.startsWith("set:")).length,0);
 const queue=createTerritoryWriteQueue(storage);
 await queue.enqueue(createTerritoryWorld(777)); // explicit reset action does this in UI
 const fixed=await loadTerritoryWorld(storage);
 assert.equal(fixed.invalid,false);
 assert.equal(fixed.world.seed,777);
});
test("write queue serialization never lets a slow older save overwrite newer territory claims",async()=>{
 const m=new Map<string,string>();
 let release:(()=>void)|null=null;
 const wait=new Promise<void>(resolve=>{release=resolve;});
 let count=0;
 const storage={
   async getItem(key:string){return m.get(key)??null;},
   async setItem(key:string,value:string){
     if(count++===0)await wait;
     m.set(key,value);
   }
 };
 const q=createTerritoryWriteQueue(storage);
 const first=createTerritoryWorld(8);
 const second=claimTerritory(first,1,0,"purchase");
 const a=q.enqueue(first),b=q.enqueue(second);
 release?.();
 await Promise.all([a,b,q.flush()]);
 assert.equal((await loadTerritoryWorld(storage)).world.active,"1,0");
 assert.equal(count,2);
});
test("invalid world is not persisted and cannot damage the existing save",async()=>{
 const storage=memory();
 const q=createTerritoryWriteQueue(storage);
 const bad={...createTerritoryWorld(8),day:-5};
 await assert.rejects(q.enqueue(bad));
 assert.equal(storage.files.has(TERRITORY_SAVE_KEY),false);
});
