import {
  createTerritoryWorld,isTerritoryWorld,TERRITORY_SAVE_KEY,type TerritoryWorld
} from "./territoryWorldModel";

/**
 * Separate namespace from Avventura, Creativa and old five-sector prototype.
 * Corrupt or inaccessible saves are never silently overwritten.
 */
export type TerritoryStorage={
  getItem(key:string):Promise<string|null>;
  setItem(key:string,value:string):Promise<unknown>;
};
export async function loadTerritoryWorld(storage:TerritoryStorage):Promise<{
  world:TerritoryWorld;invalid:boolean
}>{
  try{
    const raw=await storage.getItem(TERRITORY_SAVE_KEY);
    if(raw==null)return {world:createTerritoryWorld(),invalid:false};
    if(raw.length>8_000_000)throw new Error("Salvataggio troppo grande");
    const parsed:unknown=JSON.parse(raw);
    if(isTerritoryWorld(parsed))return {world:parsed,invalid:false};
  }catch{
    // Keep the raw value untouched; only an explicit reset is allowed to replace it.
  }
  return {world:createTerritoryWorld(),invalid:true};
}
export function createTerritoryWriteQueue(storage:TerritoryStorage){
  let tail:Promise<void>=Promise.resolve();
  let latest:Promise<void>=tail;
  return {
    enqueue(world:TerritoryWorld):Promise<void>{
      if(!isTerritoryWorld(world))return Promise.reject(new Error("Stato territorio non valido"));
      const raw=JSON.stringify(world);
      if(raw.length>8_000_000)return Promise.reject(new Error("Salvataggio troppo grande"));
      latest=tail.then(async()=>{await storage.setItem(TERRITORY_SAVE_KEY,raw);});
      tail=latest.catch(()=>{/* Keep the write queue recoverable. */});
      return latest;
    },
    flush(){return latest;}
  };
}
