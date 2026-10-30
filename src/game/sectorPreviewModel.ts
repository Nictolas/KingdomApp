/** Isolated fixed-screen kingdom preview. No GameContext or save-state dependencies. */
export const PREVIEW_COLS = 16;
export const PREVIEW_ROWS = 24;
export const SECTOR_IDS = ["centro", "nord", "sud", "est", "ovest"] as const;
export type SectorId = (typeof SECTOR_IDS)[number];
export type SectorBuilding = {
  id: string; name: string; kind: "castle" | "house" | "farm" | "shop" | "hut";
  x: number; y: number; w: number; h: number;
};
export type SectorResident = { id: string; name: string; x: number; y: number };
export type SectorPreview = {
  id: SectorId; label: string; cols: number; rows: number;
  buildings: SectorBuilding[]; residents: SectorResident[];
  occupied: ReadonlySet<number>;
};
type SectorSpec = { label: string; houseCount: number; peopleCount: number; kind: SectorBuilding["kind"]; seed: number };
export const SECTOR_SPECS: Record<SectorId, SectorSpec> = {
  centro: { label: "Centro città", houseCount: 15, peopleCount: 30, kind: "house", seed: 5 },
  nord: { label: "Nord · Bosco", houseCount: 4, peopleCount: 19, kind: "hut", seed: 11 },
  sud: { label: "Sud · Fattorie", houseCount: 8, peopleCount: 22, kind: "farm", seed: 13 },
  est: { label: "Est · Mercato", houseCount: 12, peopleCount: 21, kind: "shop", seed: 17 },
  ovest: { label: "Ovest · Quartiere", houseCount: 13, peopleCount: 18, kind: "house", seed: 19 }
};
export const SECTOR_NEIGHBORS: Record<SectorId, Partial<Record<"n"|"s"|"e"|"w", SectorId>>> = {
  centro: { n: "nord", s: "sud", e: "est", w: "ovest" },
  nord: { s: "centro" }, sud: { n: "centro" },
  est: { w: "centro" }, ovest: { e: "centro" }
};
export function neighborSector(id: SectorId, direction: "n"|"s"|"e"|"w"): SectorId | null {
  return SECTOR_NEIGHBORS[id][direction] ?? null;
}
export function isRoadCell(x: number, y: number, cols = PREVIEW_COLS, rows = PREVIEW_ROWS): boolean {
  const middleX = Math.floor(cols / 2) - 1;
  const middleY = Math.floor(rows / 2) - 1;
  return x === middleX || x === middleX + 1 || y === middleY || y === middleY + 1;
}
export function fitSquareGrid(width: number, height: number, cols = PREVIEW_COLS, rows = PREVIEW_ROWS): number {
  if (!(Number.isFinite(width) && Number.isFinite(height)) || width <= 0 || height <= 0) return 0;
  return Math.max(0, Math.floor(Math.min(width / cols, height / rows)));
}
function mixHash(x: number, y: number, seed: number): number {
  let n = Math.imul(x + 17, 92837111) ^ Math.imul(y + 23, 689287499) ^ Math.imul(seed + 9, 283923481);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}
const CENTER_HOUSE_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [1,7],[4,7],[9,1],[12,1],[9,5],[12,5],[9,8],
  [1,13],[4,13],[1,17],[4,17],[9,14],[12,14],[9,18],[12,18]
];
const RESIDENT_NAMES = ["Alaric","Mira","Leofric","Nora","Borin","Elara","Felix","Iris","Ronan","Livia","Orin","Lyra"];
export function createSectorPreview(id: SectorId, cols = PREVIEW_COLS, rows = PREVIEW_ROWS): SectorPreview {
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 8 || rows < 12) {
    throw new Error("Preview grid is too small or not integral");
  }
  const spec = SECTOR_SPECS[id];
  const buildings: SectorBuilding[] = [], occupied = new Set<number>();
  const place = (x: number, y: number, w: number, h: number, kind: SectorBuilding["kind"], name: string) => {
    if (x < 0 || y < 0 || x + w > cols || y + h > rows) return false;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (isRoadCell(xx, yy, cols, rows) || occupied.has(yy * cols + xx)) return false;
    }
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) occupied.add(yy * cols + xx);
    buildings.push({ id: id + "-b-" + buildings.length, name, kind, x, y, w, h });
    return true;
  };
  if (id === "centro") place(1, 1, 5, 5, "castle", "Castello reale");
  const slots: Array<readonly [number, number]> = id === "centro" && cols === 16 && rows === 24
    ? [...CENTER_HOUSE_SLOTS] : [];
  if (!slots.length) {
    for (let y = 1; y + 3 <= rows; y += 4)
      for (let x = 1; x + 3 <= cols; x += 4) slots.push([x, y]);
  }
  let houses = 0;
  for (const [x,y] of slots) {
    if (houses >= spec.houseCount) break;
    if (place(x,y,3,3,spec.kind, spec.kind === "house" ? "Casa " + (houses+1) : "Edificio " + (houses+1))) houses++;
  }
  // Fallback: compact grids may not fit all buildings; respect occupancy rather than overlapping.
  for (let y = 0; y + 3 <= rows && houses < spec.houseCount; y++) {
    for (let x = 0; x + 3 <= cols && houses < spec.houseCount; x++) {
      if (mixHash(x,y,spec.seed) % 3 === 0 && place(x,y,3,3,spec.kind,"Edificio "+(houses+1))) houses++;
    }
  }
  const free: Array<{x:number;y:number;priority:number}> = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (occupied.has(y * cols + x)) continue;
    free.push({x,y,priority: (isRoadCell(x,y,cols,rows) ? 0x100000000 : 0) + mixHash(x,y,spec.seed)});
  }
  free.sort((a,b)=>b.priority-a.priority);
  const residents = free.slice(0,spec.peopleCount).map((cell,index)=>({
    id: id + "-p-" + index, name: RESIDENT_NAMES[index % RESIDENT_NAMES.length] + " " + (index+1),
    x: cell.x, y: cell.y
  }));
  return {id,label:spec.label,cols,rows,buildings,residents,occupied};
}
export function generateSectorPreviewWorld(cols = PREVIEW_COLS, rows = PREVIEW_ROWS): Record<SectorId, SectorPreview> {
  return {
    centro: createSectorPreview("centro",cols,rows), nord: createSectorPreview("nord",cols,rows),
    sud: createSectorPreview("sud",cols,rows), est: createSectorPreview("est",cols,rows),
    ovest: createSectorPreview("ovest",cols,rows)
  };
}
