/**
 * Regno a territori: an independent, expandable 32×32 world.
 * Terrain is derived from seed + absolute coordinates, never rerolled when a
 * territory is revisited. Only player changes and claimed territory state save.
 * Fixed landmarks can be registered here once game design is approved.
 */
export const TERRITORY_SIDE = 32;
export const TERRITORY_CELLS = TERRITORY_SIDE * TERRITORY_SIDE;
export const TERRITORY_SAVE_KEY = "mykingdom:territories:v1";
const MAX_CLAIMED_TERRITORIES = 2048; // save-validation ceiling, not a five-sector gameplay limit
const MAX_RESOURCES = 1_000_000_000;
export type TerritoryBiome = "pianura"|"foresta"|"collina"|"palude"|"arido";
export type TerritoryTile = "grass"|"woodland"|"rock"|"water"|"road"|"dry";
export type TerritoryBuildingKind = "castle"|"house"|"farm"|"shop"|"lumber"|"guard";
export type TerritoryTool = "inspect"|"road"|"clear"|"demolish"|Exclude<TerritoryBuildingKind,"castle">;
export type TerritoryClaim = "capital"|"purchase"|"conquest";
export type Direction = "n"|"s"|"e"|"w";
export type TerritoryBuilding = {
  id:string;kind:TerritoryBuildingKind;x:number;y:number;w:number;h:number;
  name:string;builtByPlayer:boolean;
};
export type TerritoryResident = {id:string;x:number;y:number;energy:number;name:string};
export type Territory = {
  tx:number;ty:number;biome:TerritoryBiome;claim:TerritoryClaim;acquiredDay:number;
  buildings:TerritoryBuilding[];residents:TerritoryResident[];
  roads:number[];cleared:number[];
};
export type TerritoryWorld = {
  version:1;seed:number;day:number;active:string;
  gold:number;wood:number;food:number;nextBuilding:number;nextResident:number;
  territories:Record<string,Territory>;notice:string;
};
type FixedTerritorySpec={name:string;biome:TerritoryBiome};
/**
 * Only the starting point is a temporary gameplay anchor.
 * Important authored territories (mountains, royal cities etc.) remain
 * undecided. Add them to this registry later WITHOUT changing save keys.
 */
const FIXED_TERRITORIES: Readonly<Record<string,FixedTerritorySpec>>={
  "0,0":{name:"Territorio iniziale",biome:"pianura"}
};
export const BIOME_LABELS: Record<TerritoryBiome,string>={
  pianura:"Pianura",foresta:"Bosco",collina:"Colline",palude:"Palude",arido:"Terre aride"
};
const BIOMES=Object.keys(BIOME_LABELS) as TerritoryBiome[];
export const TERRITORY_BUILDINGS:Record<Exclude<TerritoryBuildingKind,"castle">,{
  wood:number;gold:number;w:number;h:number;label:string;capacity:number;
}> = {
  house:{wood:6,gold:4,w:2,h:2,label:"Casa",capacity:6},
  farm:{wood:8,gold:6,w:3,h:3,label:"Fattoria",capacity:0},
  shop:{wood:8,gold:6,w:2,h:2,label:"Bottega",capacity:0},
  lumber:{wood:7,gold:5,w:3,h:3,label:"Segheria",capacity:0},
  guard:{wood:12,gold:9,w:3,h:3,label:"Caserma",capacity:0}
};
const RESIDENT_NAMES=["Mira","Leofric","Elara","Borin","Nora","Alaric","Iris","Felix","Livia","Ronan","Orin","Lyra"];
export const PURCHASE_BASE_COST=36;
export const CONQUEST_GOLD_COST=12;
export const CONQUEST_WOOD_COST=9;
const DIR:Record<Direction,readonly [number,number]>={n:[0,-1],e:[1,0],s:[0,1],w:[-1,0]};
const START_BUILDINGS:readonly {kind:TerritoryBuildingKind;x:number;y:number;w:number;h:number}[]=[
  {kind:"castle",x:6,y:6,w:4,h:4},
  {kind:"house",x:13,y:9,w:2,h:2},
  {kind:"house",x:17,y:18,w:2,h:2},
  {kind:"farm",x:17,y:23,w:3,h:3}
];

export function territoryKey(tx:number,ty:number):string{
  if(!Number.isInteger(tx)||!Number.isInteger(ty)||Math.abs(tx)>4096||Math.abs(ty)>4096)
    throw new RangeError("Coordinate del territorio non valide");
  return tx+","+ty;
}
export function parseTerritoryKey(key:string):{tx:number;ty:number}|null{
  if(!/^(0|-[1-9]\d*|[1-9]\d*),(0|-[1-9]\d*|[1-9]\d*)$/.test(key))return null;
  const [tx,ty]=key.split(",").map(Number);
  return Number.isSafeInteger(tx)&&Number.isSafeInteger(ty)&&Math.abs(tx)<=4096&&Math.abs(ty)<=4096?
    {tx,ty}:null;
}
export function neighborCoordinates(tx:number,ty:number,d:Direction):{tx:number;ty:number;key:string}{
  const [dx,dy]=DIR[d];
  const next={tx:tx+dx,ty:ty+dy};
  return {...next,key:territoryKey(next.tx,next.ty)};
}
function hash(n:number):number{
  n=Math.imul(n^(n>>>16),0x7feb352d);
  n=Math.imul(n^(n>>>15),0x846ca68b);
  return (n^(n>>>16))>>>0;
}
function cellHash(seed:number,x:number,y:number,salt=0):number{
  return hash((seed>>>0)^Math.imul(x+928371,0x9e3779b1)^Math.imul(y+812469,0x85ebca77)^salt);
}
function unit(seed:number,x:number,y:number,salt=0):number{
  return cellHash(seed,x,y,salt)/0x100000000;
}
function smoothNoise(seed:number,x:number,y:number,salt:number):number{
  const gx=Math.floor(x/8),gy=Math.floor(y/8),fx=(x/8-gx),fy=(y/8-gy);
  const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
  const a=unit(seed,gx,gy,salt),b=unit(seed,gx+1,gy,salt);
  const c=unit(seed,gx,gy+1,salt),d=unit(seed,gx+1,gy+1,salt);
  return (a+(b-a)*sx)*(1-sy)+(c+(d-c)*sx)*sy;
}
export function biomeForTerritory(seed:number,tx:number,ty:number):TerritoryBiome{
  const fixed=FIXED_TERRITORIES[territoryKey(tx,ty)];
  if(fixed)return fixed.biome;
  const n=unit(seed,tx,ty,0x12581);
  return BIOMES[Math.min(BIOMES.length-1,Math.floor(n*BIOMES.length))]!;
}
export function territoryLabel(seed:number,tx:number,ty:number):string{
  const fixed=FIXED_TERRITORIES[territoryKey(tx,ty)];
  return fixed?.name ?? BIOME_LABELS[biomeForTerritory(seed,tx,ty)]+" "+tx+","+ty;
}
function isStartingFootprint(tx:number,ty:number,x:number,y:number):boolean{
  return tx===0&&ty===0&&START_BUILDINGS.some(b=>
    x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h);
}
export function basicRoad(x:number,y:number):boolean{
  return x===15||x===16||y===15||y===16;
}
export function groundAt(seed:number,tx:number,ty:number,x:number,y:number,biomeOverride?:TerritoryBiome):TerritoryTile{
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=TERRITORY_SIDE||y>=TERRITORY_SIDE)
    throw new RangeError("Casella fuori dal territorio");
  // Four matching road exits make adjoining maps visually/geographically continuous.
  if(basicRoad(x,y))return "road";
  if(isStartingFootprint(tx,ty,x,y))return "grass";
  const biome=biomeOverride??biomeForTerritory(seed,tx,ty);
  const gx=tx*TERRITORY_SIDE+x,gy=ty*TERRITORY_SIDE+y;
  const density=smoothNoise(seed,gx,gy,0x713a);
  const fleck=unit(seed,gx,gy,0x6d90);
  if(biome==="palude"&&density<0.38)return "water";
  if(biome==="collina"&&density>0.63&&fleck>0.38)return "rock";
  if(biome==="foresta"&&density>0.39&&fleck>0.27)return "woodland";
  if(biome==="pianura"&&density>0.73&&fleck>0.75)return "woodland";
  if(biome==="arido")return density>0.82&&fleck>0.80?"rock":"dry";
  if(biome==="palude"&&density>0.73&&fleck>0.7)return "woodland";
  return "grass";
}
export function tileAt(world:TerritoryWorld,territory:Territory,x:number,y:number):TerritoryTile{
  const cell=y*TERRITORY_SIDE+x;
  if(territory.roads.includes(cell))return "road";
  const base=groundAt(world.seed,territory.tx,territory.ty,x,y,territory.biome);
  return territory.cleared.includes(cell)&&base==="woodland"?"grass":base;
}
export function territoryPreview(world:TerritoryWorld,tx:number,ty:number){
  const key=territoryKey(tx,ty),biome=world.territories[key]?.biome??biomeForTerritory(world.seed,tx,ty);
  const distance=Math.abs(tx)+Math.abs(ty);
  const cost=PURCHASE_BASE_COST+Math.floor(distance/2)*6+(biome==="foresta"?6:0);
  const defense=2+cellHash(world.seed,tx,ty,0x91)%7;
  return {
    key,tx,ty,biome,label:territoryLabel(world.seed,tx,ty),
    owned:!!world.territories[key],
    reachable:!world.territories[key]&&Object.values(DIR).some(([dx,dy])=>
      !!world.territories[territoryKey(tx+dx,ty+dy)]),
    cost,defense
  };
}
function createTerritory(seed:number,tx:number,ty:number,claim:TerritoryClaim,day:number):Territory{
  const territory:Territory={
    tx,ty,claim,biome:biomeForTerritory(seed,tx,ty),acquiredDay:day,
    buildings:[],residents:[],roads:[],cleared:[]
  };
  if(claim==="capital"){
    territory.buildings=START_BUILDINGS.map((b,i)=>({
      ...b,id:"initial-"+i,builtByPlayer:false,
      name:b.kind==="castle"?"Castello":b.kind==="farm"?"Fattoria":"Casa "+i
    }));
    const spawn:readonly [number,number][]=[[15,11],[16,11],[15,19],[16,20],[12,15],[21,16]];
    territory.residents=spawn.map(([x,y],i)=>({
      id:"person-"+(i+1),name:RESIDENT_NAMES[i]+" "+(i+1),x,y,energy:85
    }));
  }
  return territory;
}
export function createTerritoryWorld(seed=Math.floor(Math.random()*0x100000000)):TerritoryWorld{
  const actualSeed=Number.isSafeInteger(seed)&&seed>=0&&seed<=0xffffffff?seed:0x4d594b;
  return {
    version:1,seed:actualSeed,day:1,active:"0,0",
    gold:125,wood:85,food:85,nextBuilding:1,nextResident:7,
    territories:{"0,0":createTerritory(actualSeed,0,0,"capital",1)},
    notice:"Regno fondato. Esplora i confini per acquistare o conquistare nuovi territori."
  };
}
export function worldPopulation(world:TerritoryWorld):number{
  return Object.values(world.territories).reduce((n,t)=>n+t.residents.length,0);
}
export function territoryHousing(t:Territory):number{
  return t.buildings.reduce((n,b)=>n+(b.kind==="house"?6:b.kind==="castle"?8:0),0);
}
export function worldMilitaryStrength(world:TerritoryWorld):number{
  const buildings=Object.values(world.territories).flatMap(t=>t.buildings);
  const garrisons=buildings.filter(b=>b.kind==="guard").length;
  return 2+garrisons*5+Math.floor(worldPopulation(world)/4);
}
function withNotice(world:TerritoryWorld,notice:string):TerritoryWorld{return {...world,notice};}
export function visitTerritory(world:TerritoryWorld,key:string):TerritoryWorld{
  if(!world.territories[key])return withNotice(world,"Territorio non ancora acquisito.");
  return {...world,active:key,notice:"Sei arrivato a "+territoryLabel(world.seed,world.territories[key].tx,world.territories[key].ty)+"."};
}
export function claimTerritory(world:TerritoryWorld,tx:number,ty:number,method:"purchase"|"conquest"):TerritoryWorld{
  if(!Number.isSafeInteger(tx)||!Number.isSafeInteger(ty)||Math.abs(tx)>4096||Math.abs(ty)>4096)
    return withNotice(world,"Coordinate non valide.");
  const preview=territoryPreview(world,tx,ty);
  if(preview.owned)return visitTerritory(world,preview.key);
  if(!preview.reachable)return withNotice(world,"Puoi espanderti solo da un territorio confinante.");
  if(Object.keys(world.territories).length>=MAX_CLAIMED_TERRITORIES)
    return withNotice(world,"È stato raggiunto il limite tecnico di territori per questo salvataggio.");
  if(method==="purchase"){
    if(world.gold<preview.cost)return withNotice(world,"Servono "+preview.cost+" monete per acquistare il territorio.");
  }else{
    if(world.gold<CONQUEST_GOLD_COST||world.wood<CONQUEST_WOOD_COST)
      return withNotice(world,"La spedizione richiede "+CONQUEST_GOLD_COST+" monete e "+CONQUEST_WOOD_COST+" legni.");
    if(worldMilitaryStrength(world)<preview.defense)
      return withNotice(world,"Difesa nemica "+preview.defense+": costruisci caserme per aumentare la forza ("+worldMilitaryStrength(world)+").");
  }
  const t=createTerritory(world.seed,tx,ty,method,world.day);
  return {
    ...world,
    gold:world.gold-(method==="purchase"?preview.cost:CONQUEST_GOLD_COST),
    wood:world.wood-(method==="conquest"?CONQUEST_WOOD_COST:0),
    territories:{...world.territories,[preview.key]:t},active:preview.key,
    notice:(method==="purchase"?"Territorio acquistato: ":"Territorio conquistato: ")+preview.label+"."
  };
}
function buildingAt(t:Territory,x:number,y:number):TerritoryBuilding|undefined{
  return t.buildings.find(b=>x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h);
}
export function isFreeCell(world:TerritoryWorld,t:Territory,x:number,y:number):boolean{
  if(x<0||y<0||x>=TERRITORY_SIDE||y>=TERRITORY_SIDE)return false;
  const kind=tileAt(world,t,x,y);
  return (kind==="grass"||kind==="dry")&&!buildingAt(t,x,y)&&!t.residents.some(r=>r.x===x&&r.y===y);
}
export function canBuildAt(world:TerritoryWorld,t:Territory,x:number,y:number,
  kind:Exclude<TerritoryBuildingKind,"castle">):boolean{
  const spec=TERRITORY_BUILDINGS[kind];
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x+spec.w>TERRITORY_SIDE||y+spec.h>TERRITORY_SIDE)return false;
  for(let dy=0;dy<spec.h;dy++)for(let dx=0;dx<spec.w;dx++){
    if(!isFreeCell(world,t,x+dx,y+dy))return false;
  }
  // Buildings may be placed anywhere accessible by existing roads, not on roads.
  for(let dy=-1;dy<=spec.h;dy++)for(let dx=-1;dx<=spec.w;dx++){
    const edge=(dy===-1||dy===spec.h)?dx>=0&&dx<spec.w:(dx===-1||dx===spec.w)?dy>=0&&dy<spec.h:false;
    const nx=x+dx,ny=y+dy;
    if(edge&&nx>=0&&ny>=0&&nx<TERRITORY_SIDE&&ny<TERRITORY_SIDE&&tileAt(world,t,nx,ny)==="road")return true;
  }
  return false;
}
export function territoryAction(world:TerritoryWorld,tool:TerritoryTool,x:number,y:number):TerritoryWorld{
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=TERRITORY_SIDE||y>=TERRITORY_SIDE)
    return world;
  const old=world.territories[world.active];
  if(!old)return world;
  const existing=buildingAt(old,x,y),person=old.residents.find(r=>r.x===x&&r.y===y);
  const terrain=tileAt(world,old,x,y);
  const cell=y*TERRITORY_SIDE+x;
  if(tool==="inspect"){
    return withNotice(world,person
      ?person.name+" · energia "+person.energy+"%"
      :existing?existing.name+" · "+existing.kind
      :"Terreno: "+terrain+" · casella "+(x+1)+","+(y+1));
  }
  if(tool==="demolish"){
    if(!existing||!existing.builtByPlayer)return withNotice(world,"Puoi demolire soltanto gli edifici costruiti da te.");
    const next={...old,buildings:old.buildings.filter(b=>b.id!==existing.id)};
    return {...world,wood:Math.min(MAX_RESOURCES,world.wood+2),
      territories:{...world.territories,[world.active]:next},notice:existing.name+" demolita. Recuperati 2 legni."};
  }
  if(tool==="clear"){
    if(groundAt(world.seed,old.tx,old.ty,x,y,old.biome)!=="woodland"||old.cleared.includes(cell))
      return withNotice(world,"Puoi disboscare soltanto una casella di bosco.");
    const next={...old,cleared:[...old.cleared,cell]};
    return {...world,wood:Math.min(MAX_RESOURCES,world.wood+2),
      territories:{...world.territories,[world.active]:next},notice:"Bosco disboscato, ottenuti 2 legni."};
  }
  if(tool==="road"){
    if(world.wood<1)return withNotice(world,"Serve 1 legno per costruire una strada.");
    if(terrain!=="grass"&&terrain!=="dry")return withNotice(world,"Prima libera il terreno: le strade richiedono terra pianeggiante.");
    if(!isFreeCell(world,old,x,y))return withNotice(world,"Casella occupata: impossibile costruire la strada.");
    const links=Object.values(DIR).some(([dx,dy])=>{
      const xx=x+dx,yy=y+dy;
      return xx>=0&&yy>=0&&xx<TERRITORY_SIDE&&yy<TERRITORY_SIDE&&tileAt(world,old,xx,yy)==="road";
    });
    if(!links)return withNotice(world,"La nuova strada deve collegarsi a una strada esistente.");
    const next={...old,roads:[...old.roads,cell]};
    return {...world,wood:world.wood-1,territories:{...world.territories,[world.active]:next},
      notice:"Strada costruita alla casella "+(x+1)+","+(y+1)+"."};
  }
  const spec=TERRITORY_BUILDINGS[tool];
  if(world.wood<spec.wood||world.gold<spec.gold)
    return withNotice(world,"Risorse insufficienti: servono "+spec.wood+" legni e "+spec.gold+" monete.");
  if(!canBuildAt(world,old,x,y,tool))
    return withNotice(world,"Posiziona l'edificio su terreno libero, non roccioso o acquatico, accanto a una strada.");
  const b:TerritoryBuilding={
    id:"built-"+world.nextBuilding,kind:tool,name:spec.label+" "+world.nextBuilding,
    x,y,w:spec.w,h:spec.h,builtByPlayer:true
  };
  const next={...old,buildings:[...old.buildings,b]};
  return {...world,gold:world.gold-spec.gold,wood:world.wood-spec.wood,
    nextBuilding:world.nextBuilding+1,
    territories:{...world.territories,[world.active]:next},
    notice:b.name+" costruita. Puoi posizionare gli edifici dove vuoi, purché collegati alle strade."};
}
export function buildAtFirstAvailable(world:TerritoryWorld,kind:Exclude<TerritoryBuildingKind,"castle">):TerritoryWorld{
  const t=world.territories[world.active];
  if(!t)return world;
  for(let y=0;y<TERRITORY_SIDE;y++)for(let x=0;x<TERRITORY_SIDE;x++){
    if(canBuildAt(world,t,x,y,kind))return territoryAction(world,kind,x,y);
  }
  return withNotice(world,"Nessuno spazio collegato alla strada per questo edificio. Costruisci altre strade.");
}
const STEPS:readonly (readonly [number,number])[]=[[0,-1],[1,0],[0,1],[-1,0]];
function moveResidents(world:TerritoryWorld,t:Territory,day:number):TerritoryResident[]{
  const occupied=new Set<number>(t.residents.map(p=>p.y*TERRITORY_SIDE+p.x));
  const blocked=new Set<number>();
  for(const b of t.buildings)for(let yy=b.y;yy<b.y+b.h;yy++)for(let xx=b.x;xx<b.x+b.w;xx++)
    blocked.add(yy*TERRITORY_SIDE+xx);
  return t.residents.map((p,i)=>{
    occupied.delete(p.y*TERRITORY_SIDE+p.x);
    let x=p.x,y=p.y;
    for(let k=0;k<4;k++){
      const [dx,dy]=STEPS[(day+i+k)%4]!;
      const xx=x+dx,yy=y+dy,cell=yy*TERRITORY_SIDE+xx;
      if(xx<0||yy<0||xx>=TERRITORY_SIDE||yy>=TERRITORY_SIDE||
        blocked.has(cell)||occupied.has(cell))continue;
      const terrain=tileAt(world,t,xx,yy);
      if(terrain==="water"||terrain==="rock"||terrain==="woodland")continue;
      x=xx;y=yy;break;
    }
    occupied.add(y*TERRITORY_SIDE+x);
    return {...p,x,y,energy:Math.max(15,Math.min(100,p.energy+(day%3===0?3:-1)))};
  });
}
function spawnNewResident(world:TerritoryWorld,t:Territory):TerritoryResident|null{
  const occupied=new Set(t.residents.map(r=>r.y*TERRITORY_SIDE+r.x));
  for(let k=0;k<TERRITORY_CELLS;k++){
    const cell=((Math.imul(world.nextResident,31)+k*37)%TERRITORY_CELLS+TERRITORY_CELLS)%TERRITORY_CELLS;
    const x=cell%TERRITORY_SIDE,y=Math.floor(cell/TERRITORY_SIDE);
    if(!occupied.has(cell)&&isFreeCell(world,t,x,y)){
      const id=world.nextResident;
      return {id:"person-"+id,name:RESIDENT_NAMES[id%RESIDENT_NAMES.length]+" "+id,x,y,energy:90};
    }
    if(!occupied.has(cell)&&tileAt(world,t,x,y)==="road")return {
      id:"person-"+world.nextResident,
      name:RESIDENT_NAMES[world.nextResident%RESIDENT_NAMES.length]+" "+world.nextResident,
      x,y,energy:90
    };
  }
  return null;
}
export function advanceTerritoryDay(world:TerritoryWorld):TerritoryWorld{
  const territories:Record<string,Territory>={};
  let foodProduction=0,woodProduction=0,goldProduction=0,population=0,nextResident=world.nextResident;
  const day=world.day+1;
  for(const [key,t] of Object.entries(world.territories)){
    for(const b of t.buildings){
      if(b.kind==="farm")foodProduction+=10;
      if(b.kind==="lumber")woodProduction+=6;
      if(b.kind==="shop")goldProduction+=5;
    }
    let residents=moveResidents(world,t,day);
    population+=residents.length;
    if(day%4===0 && world.food>5 && residents.length<territoryHousing(t)){
      const newcomer=spawnNewResident({...world,nextResident}, {...t,residents});
      if(newcomer){residents=[...residents,newcomer];nextResident++;population++;}
    }
    territories[key]={...t,residents};
  }
  const consumption=Math.ceil(population/4),food=world.food+foodProduction-consumption;
  return {...world,day,territories,nextResident,
    gold:Math.min(MAX_RESOURCES,world.gold+goldProduction),
    wood:Math.min(MAX_RESOURCES,world.wood+woodProduction),
    food:Math.max(0,Math.min(MAX_RESOURCES,food)),
    notice:food<0?"Cibo esaurito: costruisci più fattorie.":"Giorno "+day+
      ": produzione e abitanti aggiornati in tutti i "+Object.keys(territories).length+" territori."
  };
}
function isInt(n:unknown,min:number,max:number):n is number{
  return Number.isSafeInteger(n)&&(n as number)>=min&&(n as number)<=max;
}
const KINDS=new Set<TerritoryBuildingKind>(["castle","house","farm","shop","lumber","guard"]);
const CLAIMS=new Set<TerritoryClaim>(["capital","purchase","conquest"]);
/** Reject corrupted/untrusted saves before render, with finite bounds on arrays and coordinates. */
export function isTerritoryWorld(raw:unknown):raw is TerritoryWorld{
  if(!raw||typeof raw!=="object")return false;
  const w=raw as Partial<TerritoryWorld>;
  if(w.version!==1||!isInt(w.seed,0,0xffffffff)||!isInt(w.day,1,100000000)||
    !isInt(w.gold,0,MAX_RESOURCES)||!isInt(w.wood,0,MAX_RESOURCES)||
    !isInt(w.food,0,MAX_RESOURCES)||!isInt(w.nextBuilding,1,MAX_RESOURCES)||
    !isInt(w.nextResident,1,MAX_RESOURCES)||
    typeof w.notice!=="string"||w.notice.length>500||
    !w.territories||typeof w.territories!=="object"||Array.isArray(w.territories)||
    typeof w.active!=="string"||!w.territories[w.active]||
    !w.territories["0,0"])return false;
  const entries=Object.entries(w.territories);
  if(entries.length<1||entries.length>MAX_CLAIMED_TERRITORIES)return false;
  const world=w as TerritoryWorld;
  const allIds=new Set<string>();
  for(const [key,t] of entries){
    const coords=parseTerritoryKey(key);
    if(!coords||!t||typeof t!=="object"||t.tx!==coords.tx||t.ty!==coords.ty||
      !BIOMES.includes(t.biome)||
      !CLAIMS.has(t.claim)||!isInt(t.acquiredDay,1,world.day)||
      (key==="0,0" ? t.claim!=="capital" : t.claim==="capital")||
      !Array.isArray(t.buildings)||t.buildings.length>TERRITORY_CELLS||
      !Array.isArray(t.residents)||t.residents.length>TERRITORY_CELLS||
      !Array.isArray(t.roads)||t.roads.length>TERRITORY_CELLS||
      !Array.isArray(t.cleared)||t.cleared.length>TERRITORY_CELLS)return false;
    const roads=new Set<number>(),cleared=new Set<number>();
    for(const i of t.cleared){
      if(!isInt(i,0,TERRITORY_CELLS-1)||cleared.has(i))return false;
      cleared.add(i);
      const x=i%TERRITORY_SIDE,y=Math.floor(i/TERRITORY_SIDE);
      if(groundAt(world.seed,t.tx,t.ty,x,y,t.biome)!=="woodland")return false;
    }
    for(const i of t.roads){
      if(!isInt(i,0,TERRITORY_CELLS-1)||roads.has(i))return false;
      roads.add(i);
      const x=i%TERRITORY_SIDE,y=Math.floor(i/TERRITORY_SIDE);
      const base=groundAt(world.seed,t.tx,t.ty,x,y,t.biome);
      if(base!=="grass"&&base!=="dry"&&!(cleared.has(i)&&base==="woodland"))return false;
    }
    const taken=new Set<number>();
    for(const b of t.buildings){
      if(!b||typeof b.id!=="string"||!b.id||b.id.length>100||allIds.has(b.id)||
        typeof b.name!=="string"||b.name.length>120||!KINDS.has(b.kind)||
        typeof b.builtByPlayer!=="boolean"||
        !isInt(b.x,0,TERRITORY_SIDE-1)||!isInt(b.y,0,TERRITORY_SIDE-1)||
        !isInt(b.w,1,TERRITORY_SIDE)||!isInt(b.h,1,TERRITORY_SIDE)||
        b.x+b.w>TERRITORY_SIDE||b.y+b.h>TERRITORY_SIDE)return false;
      allIds.add(b.id);
      for(let yy=b.y;yy<b.y+b.h;yy++)for(let xx=b.x;xx<b.x+b.w;xx++){
        const i=yy*TERRITORY_SIDE+xx;
        if(taken.has(i)||tileAt(world,t,xx,yy)==="water"||
          tileAt(world,t,xx,yy)==="rock"||tileAt(world,t,xx,yy)==="woodland"||
          tileAt(world,t,xx,yy)==="road")return false;
        taken.add(i);
      }
    }
    for(const p of t.residents){
      if(!p||typeof p.id!=="string"||!p.id||p.id.length>100||allIds.has(p.id)||
        typeof p.name!=="string"||p.name.length>100||
        !isInt(p.x,0,TERRITORY_SIDE-1)||!isInt(p.y,0,TERRITORY_SIDE-1)||
        !isInt(p.energy,0,100))return false;
      allIds.add(p.id);
      const cell=p.y*TERRITORY_SIDE+p.x,kind=tileAt(world,t,p.x,p.y);
      if(taken.has(cell)||kind==="water"||kind==="rock"||kind==="woodland")return false;
      taken.add(cell);
    }
  }
  return true;
}
