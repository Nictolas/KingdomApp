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
/** Pure measurement of the *actual* map container (already inside the device safe area).
 * Classifications are guidance for manual verification, not proof of legibility. */
export function measureSectorPreviewViewport(width: number, height: number): {
  cell: number; gridWidth: number; gridHeight: number;
  legibility: "unavailable" | "tiny" | "compact" | "readable";
} {
  const cell = fitSquareGrid(width - 10, height - 12);
  return {
    cell, gridWidth: PREVIEW_COLS * cell, gridHeight: PREVIEW_ROWS * cell,
    legibility: cell === 0 ? "unavailable" : cell < 10 ? "tiny" : cell < 14 ? "compact" : "readable"
  };
}

/** The four 44-point direction buttons live in a separate 52-point row.
 * Map measurements are made inside the already-inset SafeAreaView, and the
 * grid is centered only in the area ABOVE that row. This prevents arrows
 * from hiding residents/buildings even on compact screens. */
export const SECTOR_PREVIEW_NAV_ROW_HEIGHT = 52;
export function measureSectorPreviewNavigationLayout(width: number, height: number) {
  const usableHeight = Number.isFinite(height) ? Math.max(0, height - SECTOR_PREVIEW_NAV_ROW_HEIGHT) : NaN;
  const measured = measureSectorPreviewViewport(width, usableHeight);
  const gridTop = Number.isFinite(usableHeight) ? (usableHeight - measured.gridHeight) / 2 : 0;
  const navigationTop = Number.isFinite(height) ? height - SECTOR_PREVIEW_NAV_ROW_HEIGHT + 4 : 0;
  return {
    ...measured,
    gridTop,
    gridBottom: gridTop + measured.gridHeight,
    navigationTop,
    arrowsFit: Number.isFinite(width) && width >= 4 * 44 + 3 * 8 &&
      Number.isFinite(height) && height >= SECTOR_PREVIEW_NAV_ROW_HEIGHT,
  };
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


/**
 * Resolve taps on small square tiles without adding pan or zoom.
 * Exact occupied cells win; a nearby resident is selected only on empty cells.
 * Coordinates are local to the grid, not to the full screen.
 */
export type SectorPreviewHit = { id: string; name: string; kind: "resident" | "building" };
export function hitTestSectorPreview(
  preview: SectorPreview,
  px: number,
  py: number,
  cellSize: number,
  neighborRadiusPx = 22
): SectorPreviewHit | null {
  if (![px, py, cellSize, neighborRadiusPx].every(Number.isFinite) ||
      cellSize <= 0 || neighborRadiusPx < 0 || px < 0 || py < 0 ||
      px >= preview.cols * cellSize || py >= preview.rows * cellSize) return null;
  const x = Math.floor(px / cellSize), y = Math.floor(py / cellSize);
  const resident = preview.residents.find(p => p.x === x && p.y === y);
  if (resident) return { id: resident.id, name: resident.name, kind: "resident" };
  const building = preview.buildings.find(b =>
    x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h
  );
  if (building) return { id: building.id, name: building.name, kind: "building" };
  let nearest: SectorResident | null = null;
  // A fixed 22-point radius would cover several unrelated cells in landscape.
  // Keep the recovery radius within 1.5 tiles on tiny displays.
  const effectiveRadius = Math.min(neighborRadiusPx, cellSize * 1.5);
  let nearestSquared = effectiveRadius * effectiveRadius;
  for (const person of preview.residents) {
    const dx = px - (person.x + 0.5) * cellSize;
    const dy = py - (person.y + 0.5) * cellSize;
    const squared = dx * dx + dy * dy;
    if (squared < nearestSquared) {
      nearestSquared = squared;
      nearest = person;
    }
  }
  return nearest ? { id: nearest.id, name: nearest.name, kind: "resident" } : null;
}

/** Select every entity without requiring pixel-perfect taps on tiny phone tiles. */
export function cycleSectorPreviewEntity(
  preview: SectorPreview,
  selectedId: string | null,
  step: -1 | 1
): SectorPreviewHit | null {
  const buildingCount = preview.buildings.length;
  const total = buildingCount + preview.residents.length;
  if (total === 0) return null;
  let selectedIndex = -1;
  for (let i = 0; i < total; i++) {
    const id = i < buildingCount ? preview.buildings[i].id : preview.residents[i - buildingCount].id;
    if (id === selectedId) { selectedIndex = i; break; }
  }
  const nextIndex = selectedIndex < 0 ? (step === 1 ? 0 : total - 1)
    : (selectedIndex + step + total) % total;
  if (nextIndex < buildingCount) {
    const b = preview.buildings[nextIndex];
    return { id: b.id, name: b.name, kind: "building" };
  }
  const p = preview.residents[nextIndex - buildingCount];
  return { id: p.id, name: p.name, kind: "resident" };
}

/** 1-based position in the accessible building-then-resident selection sequence. */
export function sectorPreviewSelectionInfo(
  preview: SectorPreview, selectedId: string | null
): { index: number; total: number; x: number; y: number; kind: SectorPreviewHit["kind"] } | null {
  if (!selectedId) return null;
  const total = preview.buildings.length + preview.residents.length;
  const buildingIndex = preview.buildings.findIndex(b => b.id === selectedId);
  if (buildingIndex !== -1) {
    const b = preview.buildings[buildingIndex];
    return { index: buildingIndex + 1, total, x: b.x, y: b.y, kind: "building" };
  }
  const residentIndex = preview.residents.findIndex(p => p.id === selectedId);
  if (residentIndex === -1) return null;
  const p = preview.residents[residentIndex];
  return { index: preview.buildings.length + residentIndex + 1, total, x: p.x, y: p.y, kind: "resident" };
}
