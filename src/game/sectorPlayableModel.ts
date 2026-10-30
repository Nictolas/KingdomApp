import {
  generateSectorPreviewWorld, isRoadCell, PREVIEW_COLS, PREVIEW_ROWS, SECTOR_IDS,
  type SectorBuilding, type SectorId, type SectorResident
} from "./sectorPreviewModel";

export type SectorBuildKind = "house" | "farm" | "shop";
export type SectorActionMode = "inspect" | SectorBuildKind | "demolish";
export type PlayableBuilding = SectorBuilding & { builtByPlayer?: boolean };
export type PlayableResident = SectorResident & { energy: number };
export type PlayableSector = { buildings: PlayableBuilding[]; residents: PlayableResident[] };
export type PlayableKingdom = {
  version: 1; day: number; sector: SectorId; gold: number; wood: number; food: number;
  nextBuilding: number; sectors: Record<SectorId, PlayableSector>; notice: string;
};
export const PLAYABLE_SAVE_KEY = "mykingdom:sectors:playable:v1";
export const COSTS: Record<SectorBuildKind, { wood: number; gold: number; w: number; h: number; name: string }> = {
  house: { wood: 6, gold: 4, w: 2, h: 2, name: "Casa" },
  farm: { wood: 4, gold: 3, w: 2, h: 2, name: "Fattoria" },
  shop: { wood: 8, gold: 6, w: 2, h: 2, name: "Bottega" }
};

export function createPlayableKingdom(): PlayableKingdom {
  const previews = generateSectorPreviewWorld();
  const sectors = {} as PlayableKingdom["sectors"];
  for (const id of SECTOR_IDS) {
    sectors[id] = {
      buildings: previews[id].buildings.map(b => ({ ...b })),
      residents: previews[id].residents.map((p,i) => ({...p,energy: 65 + i % 35}))
    };
  }
  return {
    version: 1, day: 1, sector: "centro", gold: 45, wood: 45, food: 100,
    nextBuilding: 1, sectors, notice: "Il tuo regno è pronto. Tocca una casella libera per costruire."
  };
}

/** Reject malformed or hostile local saves before they enter the render/simulation loop.
 * This validates the isolated sector save only; it never reads the main game save. */
export function isPlayableKingdom(value: unknown): value is PlayableKingdom {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<PlayableKingdom>;
  const integer = (n: unknown, min: number, max: number): n is number =>
    Number.isSafeInteger(n) && (n as number) >= min && (n as number) <= max;
  if (v.version !== 1 || !SECTOR_IDS.includes(v.sector as SectorId) ||
      !integer(v.day, 1, 1_000_000_000) || !integer(v.nextBuilding, 1, 1_000_000_000) ||
      !integer(v.gold, 0, 1_000_000_000_000) || !integer(v.wood, 0, 1_000_000_000_000) ||
      !integer(v.food, 0, 1_000_000_000_000) ||
      typeof v.notice !== "string" || v.notice.length > 500 ||
      !v.sectors || typeof v.sectors !== "object") return false;
  const kinds = new Set(["castle", "house", "farm", "shop", "hut"]);
  return SECTOR_IDS.every(id => {
    const sector = v.sectors?.[id];
    if (!sector || !Array.isArray(sector.buildings) || !Array.isArray(sector.residents) ||
        sector.buildings.length > PREVIEW_COLS * PREVIEW_ROWS ||
        sector.residents.length > PREVIEW_COLS * PREVIEW_ROWS) return false;
    const cells = new Set<number>();
    const ids = new Set<string>();
    for (const b of sector.buildings) {
      if (!b || typeof b.id !== "string" || !b.id || b.id.length > 100 ||
          ids.has(b.id) || typeof b.name !== "string" || b.name.length > 120 ||
          !kinds.has(b.kind) || (b.builtByPlayer !== undefined && typeof b.builtByPlayer !== "boolean") ||
          !integer(b.x, 0, PREVIEW_COLS - 1) || !integer(b.y, 0, PREVIEW_ROWS - 1) ||
          !integer(b.w, 1, PREVIEW_COLS) || !integer(b.h, 1, PREVIEW_ROWS) ||
          b.x + b.w > PREVIEW_COLS || b.y + b.h > PREVIEW_ROWS) return false;
      ids.add(b.id);
      for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
        const cell = y * PREVIEW_COLS + x;
        if (isRoadCell(x, y) || cells.has(cell)) return false;
        cells.add(cell);
      }
    }
    for (const p of sector.residents) {
      if (!p || typeof p.id !== "string" || !p.id || p.id.length > 100 ||
          ids.has(p.id) || typeof p.name !== "string" || p.name.length > 120 ||
          !integer(p.x, 0, PREVIEW_COLS - 1) || !integer(p.y, 0, PREVIEW_ROWS - 1) ||
          !integer(p.energy, 0, 100)) return false;
      ids.add(p.id);
      const cell = p.y * PREVIEW_COLS + p.x;
      if (cells.has(cell)) return false;
      cells.add(cell);
    }
    return true;
  });
}

export function sectorAtCell(sector: PlayableSector, x: number, y: number): PlayableBuilding | undefined {
  return sector.buildings.find(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
}
export function freeForBuilding(sector: PlayableSector, x: number, y: number, kind: SectorBuildKind): boolean {
  const size = COSTS[kind];
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 ||
    x + size.w > PREVIEW_COLS || y + size.h > PREVIEW_ROWS) return false;
  for (let yy = y; yy < y + size.h; yy++) for (let xx = x; xx < x + size.w; xx++) {
    if (isRoadCell(xx,yy) || sectorAtCell(sector,xx,yy) || sector.residents.some(r=>r.x===xx&&r.y===yy)) return false;
  }
  return true;
}
export function applySectorAction(state: PlayableKingdom, action: SectorActionMode,
  x: number, y: number): PlayableKingdom {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x<0 || y<0 || x>=PREVIEW_COLS || y>=PREVIEW_ROWS) return state;
  const sector = state.sectors[state.sector];
  const existing = sectorAtCell(sector,x,y);
  if (action === "inspect") {
    const person = sector.residents.find(p=>p.x===x&&p.y===y);
    return { ...state, notice: person
      ? `${person.name} · energia ${person.energy}%`
      : existing ? `${existing.name} · ${state.sector}` : `Terreno libero · ${x+1},${y+1}` };
  }
  if (action === "demolish") {
    if (!existing || !existing.builtByPlayer) return {...state,notice:"Puoi demolire soltanto gli edifici che hai costruito."};
    return {...state,sectors:{...state.sectors,[state.sector]:{
      ...sector,buildings:sector.buildings.filter(b=>b.id!==existing.id)
    }},wood:state.wood+2, notice:`${existing.name} demolita. Recuperati 2 legni.`};
  }
  const cost=COSTS[action];
  if (state.wood < cost.wood || state.gold < cost.gold) return {...state,notice:"Risorse insufficienti. Avanza un giorno per produrne altre."};
  if (!freeForBuilding(sector,x,y,action)) return {...state,notice:"Spazio occupato o strada: scegli un'altra area di 2×2 caselle."};
  const building:PlayableBuilding = {
    id:"new-"+state.nextBuilding,kind:action,name:cost.name+" "+state.nextBuilding,
    x,y,w:cost.w,h:cost.h,builtByPlayer:true
  };
  return { ...state,gold:state.gold-cost.gold,wood:state.wood-cost.wood,nextBuilding:state.nextBuilding+1,
    sectors:{...state.sectors,[state.sector]:{...sector,buildings:[...sector.buildings,building]}},
    notice:`${building.name} costruita in ${state.sector}. Produzione attiva dal prossimo giorno.`};
}
const DIRECTION_STEPS = [[0,-1],[1,0],[0,1],[-1,0]] as const;
function moveSectorResidents(sector: PlayableSector, day: number, idIndex: number): PlayableResident[] {
  const buildingCells=new Set<number>();
  for(const b of sector.buildings) for(let y=b.y;y<b.y+b.h;y++) for(let x=b.x;x<b.x+b.w;x++) buildingCells.add(y*PREVIEW_COLS+x);
  const occupied=new Set(sector.residents.map(p=>p.y*PREVIEW_COLS+p.x));
  return sector.residents.map((p,i)=>{
    const old=p.y*PREVIEW_COLS+p.x;
    occupied.delete(old);
    let x=p.x,y=p.y;
    const offset=(day+i*3+idIndex)%4;
    for(let k=0;k<4;k++){
      const [dx,dy]=DIRECTION_STEPS[(offset+k)%4];
      const nx=p.x+dx,ny=p.y+dy,cell=ny*PREVIEW_COLS+nx;
      if(nx<0||ny<0||nx>=PREVIEW_COLS||ny>=PREVIEW_ROWS)continue;
      if(buildingCells.has(cell)||occupied.has(cell))continue;
      x=nx;y=ny;break;
    }
    occupied.add(y*PREVIEW_COLS+x);
    return {...p,x,y,energy: Math.max(20,Math.min(100,p.energy+(day%3===0?4:-1)))};
  });
}
export function advancePlayableDay(state: PlayableKingdom): PlayableKingdom {
  const sectors = {} as PlayableKingdom["sectors"];
  let foodProduction=0,woodProduction=0,goldProduction=0,inhabitants=0;
  SECTOR_IDS.forEach((id,i)=>{
    const old=state.sectors[id];
    inhabitants+=old.residents.length;
    for(const b of old.buildings){
      if(b.kind==="farm")foodProduction+=8;
      if(b.kind==="hut")woodProduction+=4;
      if(b.kind==="shop")goldProduction+=4;
    }
    sectors[id]={...old,residents:moveSectorResidents(old,state.day+1,i)};
  });
  const consumption=Math.ceil(inhabitants/5);
  const food=state.food+foodProduction-consumption;
  const shortage=food<0;
  return {...state,day:state.day+1,sectors,
    food:Math.max(0,food),wood:state.wood+woodProduction,gold:state.gold+goldProduction,
    notice: shortage? "Cibo esaurito! Costruisci altre fattorie.":"Giorno "+(state.day+1)+": gli abitanti di tutti i settori hanno lavorato e si sono spostati."
  };
}
export function travelSector(state:PlayableKingdom,next:SectorId):PlayableKingdom{
  if(!SECTOR_IDS.includes(next))return state;
  return {...state,sector:next,notice:"Sei arrivato a "+next+". Il resto del regno continua a vivere."};
}
