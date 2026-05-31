import { isTerrenoAcqua, type TerrenoType } from "./riverGeneration";

function isAcquaCell(index: number, cols: number, rows: number): boolean {
  const row = Math.floor(index / cols);
  const col = index % cols;
  return row === 0 || row === rows - 1 || col === 0 || col === cols - 1;
}

/** Acqua reale per autotile spiaggia: fiume o mare disegnato, mai sabbia adiacente. */
function isWaterAt(
  row: number,
  col: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>
): boolean {
  if (row < 0 || row >= rows || col < 0 || col >= cols) return false;
  const index = row * cols + col;
  if ((terrenoInMappa[index] ?? "erba") === "sabbia") return false;
  return isTerrenoAcqua(index, terrenoInMappa, cols, rows);
}

function isSandAt(
  row: number,
  col: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>
): boolean {
  if (row < 0 || row >= rows || col < 0 || col >= cols) return false;
  return (terrenoInMappa[row * cols + col] ?? "erba") === "sabbia";
}

/** Indice 0…8 nel blocco 3×3 (TL,T,TR / L,C,R / BL,B,BR). */
export type Tile3x3Index = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

function subtile9FromMask(mask: number): Tile3x3Index {
  switch (mask) {
    case 0:
      return 4;
    case 1:
      return 1;
    case 2:
      return 5;
    case 3:
      return 2;
    case 4:
      return 7;
    case 5:
      return 1;
    case 6:
      return 8;
    case 7:
      return 2;
    case 8:
      return 3;
    case 9:
      return 0;
    case 10:
      return 3;
    case 11:
      return 1;
    case 12:
      return 6;
    case 13:
      return 3;
    case 14:
      return 7;
    case 15:
    default:
      return 4;
  }
}

/**
 * Autotile spiaggia: vicini cardinali con acqua (fiume o mare).
 */
export function getSandBeachSubtile(
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>
): Tile3x3Index {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const n = isWaterAt(row - 1, col, cols, rows, terrenoInMappa);
  const e = isWaterAt(row, col + 1, cols, rows, terrenoInMappa);
  const s = isWaterAt(row + 1, col, cols, rows, terrenoInMappa);
  const w = isWaterAt(row, col - 1, cols, rows, terrenoInMappa);
  const mask = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);
  return subtile9FromMask(mask);
}

/** Sprite spiaggia/sabbia 1×1 (`spiaggia_*.png`): lato o angolo verso acqua. */
export type SpiaggiaTileAsset1x1 =
  | "nord"
  | "sud"
  | "est"
  | "ovest"
  | "nord_est"
  | "nord_ovest"
  | "sud_est"
  | "sud_ovest"
  /** Sabbia piena (nessun lato verso acqua). */
  | "centro";

/** Transizione erba ↔ spiaggia 1×1 (`erba_spiaggia_*.png`). */
export type ErbaSpiaggiaTileAsset1x1 =
  | "nord"
  | "sud"
  | "est"
  | "ovest"
  | "nord_est"
  | "nord_ovest"
  | "sud_est"
  | "sud_ovest";

function spiaggiaAssetFromBeachSubtile(subtile: Tile3x3Index): SpiaggiaTileAsset1x1 {
  switch (subtile) {
    case 0:
      return "nord_ovest";
    case 1:
      return "nord";
    case 2:
      return "nord_est";
    case 3:
      return "ovest";
    case 4:
      return "centro";
    case 5:
      return "est";
    case 6:
      return "sud_ovest";
    case 7:
      return "sud";
    case 8:
      return "sud_est";
    default:
      return "centro";
  }
}

/**
 * Sceglie il PNG spiaggia 1×1: stessa maschera acqua del blocco 3×3 sullo spritesheet,
 * mappata sui file `spiaggia_*.png` (angoli, lati, centro sabbia).
 */
function getSpiaggiaAsset1x1Grezzo(
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>
): SpiaggiaTileAsset1x1 {
  return spiaggiaAssetFromBeachSubtile(getSandBeachSubtile(index, cols, rows, terrenoInMappa));
}

function erbaSpiaggiaAssetFromGrassSandSubtile(subtile: Tile3x3Index): ErbaSpiaggiaTileAsset1x1 {
  switch (subtile) {
    case 0:
      return "nord_ovest";
    case 1:
      return "nord";
    case 2:
      return "nord_est";
    case 3:
      return "ovest";
    case 5:
      return "est";
    case 6:
      return "sud_ovest";
    case 7:
      return "sud";
    case 8:
      return "sud_est";
    default:
      return "nord";
  }
}

export function isStradaCell(
  row: number,
  col: number,
  cols: number,
  rows: number,
  edificiInMappa: Record<number, { nome?: string }>
): boolean {
  if (row < 0 || row >= rows || col < 0 || col >= cols) return false;
  return edificiInMappa[row * cols + col]?.nome === "Strada";
}

/** Cella erba libera (no edificio, terreno erba). */
function isErbaPlainCell(
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, { nome?: string }>
): boolean {
  if (index < 0 || index >= cols * rows) return false;
  if (edificiInMappa[index]) return false;
  return (terrenoInMappa[index] ?? "erba") === "erba";
}

function hasWaterCardinalNeighbor(
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>
): boolean {
  const col = index % cols;
  const row = Math.floor(index / cols);
  return (
    isWaterAt(row - 1, col, cols, rows, terrenoInMappa) ||
    isWaterAt(row + 1, col, cols, rows, terrenoInMappa) ||
    isWaterAt(row, col - 1, cols, rows, terrenoInMappa) ||
    isWaterAt(row, col + 1, cols, rows, terrenoInMappa)
  );
}

function hasErbaCardinalNeighbor(
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, { nome?: string }>
): boolean {
  const col = index % cols;
  const row = Math.floor(index / cols);
  if (row > 0 && isErbaPlainCell(index - cols, cols, rows, terrenoInMappa, edificiInMappa)) return true;
  if (row < rows - 1 && isErbaPlainCell(index + cols, cols, rows, terrenoInMappa, edificiInMappa)) return true;
  if (col > 0 && isErbaPlainCell(index - 1, cols, rows, terrenoInMappa, edificiInMappa)) return true;
  if (col < cols - 1 && isErbaPlainCell(index + 1, cols, rows, terrenoInMappa, edificiInMappa)) return true;
  return false;
}

/** `strada_centro_1x1` / incrocio a 4 vie non possono confinare con erba (max 3 bracci strada). */
function fixStradaCentroAdjacentToErba(
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, { nome?: string }>,
  asset: StradaTileAsset1x1
): StradaTileAsset1x1 {
  if (asset !== "centro" && asset !== "incrocio_centro") return asset;
  if (!hasErbaCardinalNeighbor(index, cols, rows, terrenoInMappa, edificiInMappa)) return asset;
  return getStradaAsset1x1Grezzo(index, cols, rows, edificiInMappa);
}

function hasSandCardinalNeighbor(
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>
): boolean {
  const col = index % cols;
  const row = Math.floor(index / cols);
  return (
    isSandAt(row - 1, col, cols, rows, terrenoInMappa) ||
    isSandAt(row + 1, col, cols, rows, terrenoInMappa) ||
    isSandAt(row, col - 1, cols, rows, terrenoInMappa) ||
    isSandAt(row, col + 1, cols, rows, terrenoInMappa)
  );
}

/** Strada adiacente ad acqua o sabbia: tile generico di fallback. */
function fixStradaAdjacentToInvalidTerrain(
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  asset: StradaTileAsset1x1
): StradaTileAsset1x1 {
  if (
    !hasWaterCardinalNeighbor(index, cols, rows, terrenoInMappa) &&
    !hasSandCardinalNeighbor(index, cols, rows, terrenoInMappa)
  ) {
    return asset;
  }
  return "generica";
}

/**
 * Autotile strada terra (blocco 3×3): dove il vicino NON è strada serve il bordo verso erba/altro.
 */
export function getRoadDirtSubtile(
  index: number,
  cols: number,
  rows: number,
  edificiInMappa: Record<number, { nome?: string }>
): Tile3x3Index {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const n = !isStradaCell(row - 1, col, cols, rows, edificiInMappa);
  const e = !isStradaCell(row, col + 1, cols, rows, edificiInMappa);
  const s = !isStradaCell(row + 1, col, cols, rows, edificiInMappa);
  const w = !isStradaCell(row, col - 1, cols, rows, edificiInMappa);
  const mask = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);
  return subtile9FromMask(mask);
}

export type OrientamentoStrada1x1 = "orizzontale" | "verticale";

/**
 * Sprite strada 1×1: tratti dritti, punti ciechi (un solo vicino strada) per direzione cardinale.
 */
export type StradaTileAsset1x1 =
  | OrientamentoStrada1x1
  | "nord"
  | "sud"
  | "est"
  | "ovest"
  /** Angolo a L: vicini strada esattamente a N+E, N+O, S+E, S+O (es. nord+est → sopra verticale/nord, a destra orizzontale/est). */
  | "curva_nord_est"
  | "curva_nord_ovest"
  | "curva_sud_est"
  | "curva_sud_ovest"
  /** Incrocio a T (3 vicini): il nome elenca le direzioni con strada; manca quella opposta al “vuoto”. */
  | "incrocio_nord_est_ovest"
  | "incrocio_nord_est_sud"
  | "incrocio_est_sud_ovest"
  | "incrocio_est_sud_nord"
  /** Incrocio a quattro vie (N, S, E, O tutti strada). */
  | "incrocio_centro"
  /**
   * Tratto centrale 1×1 (`strada_centro_1x1`): quattro vicini strada, ciascuno solo
   * `incrocio_centro` o la T coerente con la direzione (vedi {@link isValidStradaCentroNeighbors}).
   */
  | "centro"
  /** Tile strada generico (`strada1x1.png`), es. isolato senza vicini strada. */
  | "generica";

/**
 * Sceglie lo sprite 1×1 in base ai vicini strada: più connessioni E–O → orizzontale, N–S → verticale.
 * Incroci / pareggio: default orizzontale.
 */
export function getOrientamentoStrada1x1(
  index: number,
  cols: number,
  rows: number,
  edificiInMappa: Record<number, { nome?: string }>
): OrientamentoStrada1x1 {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const n = isStradaCell(row - 1, col, cols, rows, edificiInMappa);
  const s = isStradaCell(row + 1, col, cols, rows, edificiInMappa);
  const w = isStradaCell(row, col - 1, cols, rows, edificiInMappa);
  const e = isStradaCell(row, col + 1, cols, rows, edificiInMappa);
  const h = (w ? 1 : 0) + (e ? 1 : 0);
  const v = (n ? 1 : 0) + (s ? 1 : 0);
  if (h > v) return "orizzontale";
  if (v > h) return "verticale";
  if (v > 0 && h === 0) return "verticale";
  if (h > 0 && v === 0) return "orizzontale";
  return "orizzontale";
}

/**
 * Vicino a sinistra (O) ammesso per strada_orizzontale1x1.
 * Include `est`/`ovest` per cappucci (file tipo strada_ovest / strada_est vs direzione verso il tratto).
 */
const HORIZONTAL_OK_WEST = new Set<StradaTileAsset1x1>([
  "orizzontale",
  "ovest",
  "est",
  "curva_nord_est",
  "curva_sud_est",
  "incrocio_centro"
]);

/** Vicino a destra (E) ammesso per strada_orizzontale1x1. */
const HORIZONTAL_OK_EAST = new Set<StradaTileAsset1x1>([
  "orizzontale",
  "curva_nord_ovest",
  "curva_sud_ovest",
  "ovest",
  "est",
  "incrocio_centro"
]);

/**
 * Sotto `strada_verticale1x1` o `strada_nord1x1` è ammesso solo un incastro verso sud coerente con i PNG.
 */
const ALLOWED_SOUTH_OF_VERTICAL_OR_NORD = new Set<StradaTileAsset1x1>([
  "incrocio_centro",
  "incrocio_est_sud_nord",
  "incrocio_nord_est_ovest",
  "incrocio_nord_est_sud",
  "sud",
  "verticale",
  /** Sotto un verticale, una curva a L è valida; non va sostituita con una T `incrocio_nord_est_sud`. */
  "curva_nord_est",
  "curva_nord_ovest",
  "curva_sud_est",
  "curva_sud_ovest"
]);

/**
 * Sotto `curva_sud_ovest` o `incrocio_est_sud_ovest` a nord: stessa whitelist di incastro verso sud.
 */
const ALLOWED_SOUTH_OF_CURVA_SUD_OVEST_OR_INCROCIO_EST_SUD_OVEST = new Set<StradaTileAsset1x1>([
  "curva_nord_ovest",
  "centro",
  "incrocio_centro",
  "incrocio_est_sud_nord",
  "incrocio_nord_est_ovest",
  "incrocio_nord_est_sud",
  "sud",
  "verticale"
]);

/** Sopra `strada_centro_1x1`: incrocio ammesso, altra `strada_centro_1x1`, o T con bracci E+S+O. */
const CENTRO_OK_NORTH = new Set<StradaTileAsset1x1>(["centro", "incrocio_centro", "incrocio_est_sud_ovest"]);

/** A destra di `strada_centro_1x1`: incrocio ammesso, altra `strada_centro_1x1`, o T con bracci E+S+N. */
const CENTRO_OK_EAST = new Set<StradaTileAsset1x1>(["centro", "incrocio_centro", "incrocio_est_sud_nord"]);

/** Sotto `strada_centro_1x1`: incrocio ammesso, altra `strada_centro_1x1`, o T con bracci N+E+O. */
const CENTRO_OK_SOUTH = new Set<StradaTileAsset1x1>(["centro", "incrocio_centro", "incrocio_nord_est_ovest"]);

/** A sinistra di `strada_centro_1x1`: incrocio ammesso, altra `strada_centro_1x1`, o T con bracci N+E+S. */
const CENTRO_OK_WEST = new Set<StradaTileAsset1x1>(["centro", "incrocio_centro", "incrocio_nord_est_sud"]);

function isValidStradaCentroNeighbors(
  north: StradaTileAsset1x1 | null | undefined,
  east: StradaTileAsset1x1 | null | undefined,
  south: StradaTileAsset1x1 | null | undefined,
  west: StradaTileAsset1x1 | null | undefined
): boolean {
  return (
    north != null &&
    CENTRO_OK_NORTH.has(north) &&
    east != null &&
    CENTRO_OK_EAST.has(east) &&
    south != null &&
    CENTRO_OK_SOUTH.has(south) &&
    west != null &&
    CENTRO_OK_WEST.has(west)
  );
}

function cardinalStrada(
  index: number,
  cols: number,
  rows: number,
  edificiInMappa: Record<number, { nome?: string }>
): { n: boolean; s: boolean; w: boolean; e: boolean } {
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    n: isStradaCell(row - 1, col, cols, rows, edificiInMappa),
    s: isStradaCell(row + 1, col, cols, rows, edificiInMappa),
    w: isStradaCell(row, col - 1, cols, rows, edificiInMappa),
    e: isStradaCell(row, col + 1, cols, rows, edificiInMappa)
  };
}

/** Tratto E–O “puro”: vicini strada solo a W ed E (nessun N/S). */
function isStradaSoloOrizzontale(
  index: number,
  cols: number,
  rows: number,
  edificiInMappa: Record<number, { nome?: string }>
): boolean {
  const { n, s, w, e } = cardinalStrada(index, cols, rows, edificiInMappa);
  return w && e && !n && !s;
}

function walkWestStradaOrizzontale(
  index: number,
  cols: number,
  rows: number,
  edificiInMappa: Record<number, { nome?: string }>
): number {
  const row = Math.floor(index / cols);
  let lo = index;
  while (true) {
    const w = lo - 1;
    if (w < 0 || Math.floor(w / cols) !== row) break;
    if (!isStradaSoloOrizzontale(w, cols, rows, edificiInMappa)) break;
    lo = w;
  }
  return lo;
}

function walkEastStradaOrizzontale(
  index: number,
  cols: number,
  rows: number,
  edificiInMappa: Record<number, { nome?: string }>
): number {
  const row = Math.floor(index / cols);
  let hi = index;
  while (true) {
    const e = hi + 1;
    if (e >= cols * rows || Math.floor(e / cols) !== row) break;
    if (!isStradaSoloOrizzontale(e, cols, rows, edificiInMappa)) break;
    hi = e;
  }
  return hi;
}

/**
 * Asset “grezzo” dalla sola topologia (senza validare incastri E–O degli orizzontali).
 * Usato per cappi di segmento e per ricorsioni interne.
 */
function getStradaAsset1x1Grezzo(
  index: number,
  cols: number,
  rows: number,
  edificiInMappa: Record<number, { nome?: string }>
): StradaTileAsset1x1 {
  const { n, s, w, e } = cardinalStrada(index, cols, rows, edificiInMappa);
  const count = (n ? 1 : 0) + (s ? 1 : 0) + (w ? 1 : 0) + (e ? 1 : 0);

  if (count === 1) {
    if (n) {
      const row = Math.floor(index / cols);
      const col = index % cols;
      /**
       * Un solo vicino a nord: sei il cappio a valle di un tratto verticale se sopra di te c’è ancora strada.
       * In quel caso lo sprite corretto è `strada_sud1x1` (connessione verso nord), non `strada_nord1x1`.
       */
      if (
        row >= 2 &&
        isStradaCell(row - 2, col, cols, rows, edificiInMappa) &&
        isStradaCell(row - 1, col, cols, rows, edificiInMappa)
      ) {
        return "sud";
      }
      return "nord";
    }
    /**
     * `strada_sud1x1` richiede sempre strada a nord (connessione verso l’alto).
     * Un solo vicino a sud = cappio verso il basso → altro sprite (nord), non `sud`.
     */
    if (s) return "nord";
    if (e) return "est";
    return "ovest";
  }
  if (count === 2) {
    if (n && s) return "verticale";
    if (w && e) return "orizzontale";
    if (n && e) return "curva_nord_est";
    if (n && w) return "curva_nord_ovest";
    if (s && e) return "curva_sud_est";
    if (s && w) return "curva_sud_ovest";
    return getOrientamentoStrada1x1(index, cols, rows, edificiInMappa);
  }
  /** T: 3 bracci; il nome asset elenca le tre direzioni collegate (quella assente è il “dorso” della T). */
  if (count === 3) {
    if (n && e && w && !s) return "incrocio_nord_est_ovest";
    if (n && e && s && !w) return "incrocio_nord_est_sud";
    if (e && s && w && !n) return "incrocio_est_sud_ovest";
    if (n && s && w && !e) return "incrocio_est_sud_nord";
    return getOrientamentoStrada1x1(index, cols, rows, edificiInMappa);
  }
  if (count === 4) return "incrocio_centro";
  if (count === 0) return "generica";
  return getOrientamentoStrada1x1(index, cols, rows, edificiInMappa);
}

/**
 * Sceglie quale PNG 1×1 usare: tratti dritti (2 vicini opposti), punti ciechi (1 vicino),
 * curve a L (2 vicini ortogonali), T/incroci come in {@link getOrientamentoStrada1x1}.
 * Per `strada_orizzontale1x1` richiede che a Ovest ci sia solo un asset tra
 * ovest / curva_nord_est / curva_sud_est / orizzontale, e a Est solo tra
 * orizzontale / curva_nord_ovest / curva_sud_ovest (incastro del segmento E–O).
 *
 * Le regole “sotto verticale / strada_nord” e “sotto curva_sud_ovest / incrocio_est_sud_ovest” si applicano in
 * {@link buildStradaAssetLookup}.
 */
function getStradaAsset1x1Base(
  index: number,
  cols: number,
  rows: number,
  edificiInMappa: Record<number, { nome?: string }>
): StradaTileAsset1x1 {
  if (!isStradaSoloOrizzontale(index, cols, rows, edificiInMappa)) {
    return getStradaAsset1x1Grezzo(index, cols, rows, edificiInMappa);
  }

  const lo = walkWestStradaOrizzontale(index, cols, rows, edificiInMappa);
  const hi = walkEastStradaOrizzontale(index, cols, rows, edificiInMappa);

  const westOfLo = lo - 1;
  const eastOfHi = hi + 1;
  const row = Math.floor(index / cols);

  const tipoWestEstremo =
    westOfLo >= 0 && Math.floor(westOfLo / cols) === row && edificiInMappa[westOfLo]?.nome === "Strada"
      ? getStradaAsset1x1Grezzo(westOfLo, cols, rows, edificiInMappa)
      : null;
  const tipoEastEstremo =
    eastOfHi < cols * rows && Math.floor(eastOfHi / cols) === row && edificiInMappa[eastOfHi]?.nome === "Strada"
      ? getStradaAsset1x1Grezzo(eastOfHi, cols, rows, edificiInMappa)
      : null;

  const assetOvest =
    index === lo ? tipoWestEstremo : "orizzontale";
  const assetEst =
    index === hi ? tipoEastEstremo : "orizzontale";

  const ok =
    assetOvest != null &&
    assetEst != null &&
    HORIZONTAL_OK_WEST.has(assetOvest) &&
    HORIZONTAL_OK_EAST.has(assetEst);

  if (ok) return "orizzontale";
  /** Incastro E–O non valido rispetto alle regole: fallback al tipo grezzo (stesso tratto, sprite eventualmente da correggere in generazione). */
  return getStradaAsset1x1Grezzo(index, cols, rows, edificiInMappa);
}

/**
 * Se a nord c’è `verticale` o `nord`, la cella corrente deve usare solo asset compatibili con l’incastro verso sud.
 */
function clampSouthOfVerticalOrNord(
  index: number,
  cols: number,
  rows: number,
  edificiInMappa: Record<number, { nome?: string }>
): StradaTileAsset1x1 {
  const g = getStradaAsset1x1Grezzo(index, cols, rows, edificiInMappa);
  if (ALLOWED_SOUTH_OF_VERTICAL_OR_NORD.has(g)) return g;

  const { n, s, w, e } = cardinalStrada(index, cols, rows, edificiInMappa);
  const count = (n ? 1 : 0) + (s ? 1 : 0) + (w ? 1 : 0) + (e ? 1 : 0);

  if (count === 4) return "incrocio_centro";
  if (count === 2 && n && s) return "verticale";
  if (count === 1 && n) {
    return "sud";
  }
  if (count === 1 && s) return "nord";
  if (count === 3) {
    if (n && e && w && !s) return "incrocio_nord_est_ovest";
    if (n && e && s && !w) return "incrocio_nord_est_sud";
    if (e && s && w && !n) return "incrocio_est_sud_ovest";
    if (n && s && w && !e) return "incrocio_est_sud_nord";
  }
  if (count === 2) {
    if (n && e) return "curva_nord_est";
    if (n && w) return "curva_nord_ovest";
    if (s && e) return "curva_sud_est";
    if (s && w) return "curva_sud_ovest";
  }
  return "verticale";
}

/**
 * Sotto `curva_sud_ovest` / `incrocio_est_sud_ovest` a nord: solo asset in
 * {@link ALLOWED_SOUTH_OF_CURVA_SUD_OVEST_OR_INCROCIO_EST_SUD_OVEST}.
 */
function clampSouthBelowCurvaOrIncrocioEstSudOvest(
  index: number,
  cols: number,
  rows: number,
  edificiInMappa: Record<number, { nome?: string }>
): StradaTileAsset1x1 {
  const g = getStradaAsset1x1Grezzo(index, cols, rows, edificiInMappa);
  if (ALLOWED_SOUTH_OF_CURVA_SUD_OVEST_OR_INCROCIO_EST_SUD_OVEST.has(g)) return g;

  const { n, s, w, e } = cardinalStrada(index, cols, rows, edificiInMappa);
  const count = (n ? 1 : 0) + (s ? 1 : 0) + (w ? 1 : 0) + (e ? 1 : 0);

  if (count === 4) return "incrocio_centro";
  if (count === 2 && n && s) return "verticale";
  if (count === 1 && n) {
    return "sud";
  }
  if (count === 1 && s) return "nord";
  if (count === 3) {
    if (n && e && w && !s) return "incrocio_nord_est_ovest";
    if (n && e && s && !w) return "incrocio_nord_est_sud";
    if (n && s && w && !e) return "incrocio_est_sud_nord";
    if (e && s && w && !n) return "incrocio_centro";
  }
  if (count === 2) {
    if (n && w) return "curva_nord_ovest";
    if (n && e) return "incrocio_nord_est_sud";
    if (s && w) return "incrocio_est_sud_nord";
    if (s && e) return "incrocio_nord_est_sud";
  }
  return "verticale";
}

/**
 * `incrocio_nord_est_sud` (T senza ovest) richiede strada a N, E e S e non a O.
 */
function fixAssetIfIncrocioNordEstSudMismatch(
  index: number,
  cols: number,
  rows: number,
  edificiInMappa: Record<number, { nome?: string }>,
  asset: StradaTileAsset1x1
): StradaTileAsset1x1 {
  if (asset !== "incrocio_nord_est_sud") return asset;
  const { n, s, w, e } = cardinalStrada(index, cols, rows, edificiInMappa);
  if (n && e && s && !w) return asset;
  return getStradaAsset1x1Base(index, cols, rows, edificiInMappa);
}

/**
 * Vincoli PNG ↔ vicini strada: `strada_sud` e `incrocio_nord_est_ovest` richiedono strada a nord;
 * `curva_sud_ovest` richiede strada a sud.
 */
function fixCardinalSpriteConstraints(
  index: number,
  cols: number,
  rows: number,
  edificiInMappa: Record<number, { nome?: string }>,
  asset: StradaTileAsset1x1
): StradaTileAsset1x1 {
  const { n, s } = cardinalStrada(index, cols, rows, edificiInMappa);
  if (asset === "sud" && !n) {
    return getStradaAsset1x1Base(index, cols, rows, edificiInMappa);
  }
  if (asset === "curva_sud_ovest" && !s) {
    return getStradaAsset1x1Base(index, cols, rows, edificiInMappa);
  }
  if (asset === "incrocio_nord_est_ovest" && !n) {
    return getStradaAsset1x1Base(index, cols, rows, edificiInMappa);
  }
  return asset;
}

/**
 * Celle con strada a N, E, S e O: `centro` se ogni vicino è un incrocio ammesso, un'altra
 * `strada_centro_1x1`, o la T coerente per quella direzione; altrimenti `incrocio_centro`.
 */
function resolveCentroVsIncrocioCentro(
  index: number,
  cols: number,
  rows: number,
  edificiInMappa: Record<number, { nome?: string }>,
  lookup: Map<number, StradaTileAsset1x1>
): StradaTileAsset1x1 {
  const { n, s, w, e } = cardinalStrada(index, cols, rows, edificiInMappa);
  const count = (n ? 1 : 0) + (s ? 1 : 0) + (w ? 1 : 0) + (e ? 1 : 0);
  if (count !== 4) return lookup.get(index) ?? "orizzontale";

  const northAsset = n ? lookup.get(index - cols) : null;
  const eastAsset = e ? lookup.get(index + 1) : null;
  const southAsset = s ? lookup.get(index + cols) : null;
  const westAsset = w ? lookup.get(index - 1) : null;

  if (isValidStradaCentroNeighbors(northAsset, eastAsset, southAsset, westAsset)) {
    return "centro";
  }
  return "incrocio_centro";
}

/**
 * Lookup per indice cella: whitelist verso sud (sotto verticale/nord, sotto curva_sud_ovest o incrocio_est_sud_ovest) in ordine per righe.
 */
export function buildStradaAssetLookup(
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, { nome?: string }>
): (index: number) => StradaTileAsset1x1 {
  const final = new Map<number, StradaTileAsset1x1>();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      if (edificiInMappa[index]?.nome !== "Strada") continue;

      let asset = getStradaAsset1x1Base(index, cols, rows, edificiInMappa);

      if (row > 0 && edificiInMappa[index - cols]?.nome === "Strada") {
        const northAsset = final.get(index - cols);
        if (northAsset != null) {
          if (
            (northAsset === "verticale" || northAsset === "nord") &&
            !ALLOWED_SOUTH_OF_VERTICAL_OR_NORD.has(asset)
          ) {
            asset = clampSouthOfVerticalOrNord(index, cols, rows, edificiInMappa);
          }
          if (
            (northAsset === "curva_sud_ovest" || northAsset === "incrocio_est_sud_ovest") &&
            !ALLOWED_SOUTH_OF_CURVA_SUD_OVEST_OR_INCROCIO_EST_SUD_OVEST.has(asset)
          ) {
            asset = clampSouthBelowCurvaOrIncrocioEstSudOvest(index, cols, rows, edificiInMappa);
          }
        }
      }

      asset = fixAssetIfIncrocioNordEstSudMismatch(index, cols, rows, edificiInMappa, asset);
      asset = fixCardinalSpriteConstraints(index, cols, rows, edificiInMappa, asset);

      final.set(index, asset);
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      if (edificiInMappa[index]?.nome !== "Strada") continue;
      const asset = final.get(index);
      if (asset === "centro" || asset === "incrocio_centro") {
        final.set(index, resolveCentroVsIncrocioCentro(index, cols, rows, edificiInMappa, final));
      }
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const index = row * cols + col;
        if (edificiInMappa[index]?.nome !== "Strada") continue;
        const { n, s, w, e } = cardinalStrada(index, cols, rows, edificiInMappa);
        const count = (n ? 1 : 0) + (s ? 1 : 0) + (w ? 1 : 0) + (e ? 1 : 0);
        if (count !== 4) continue;
        const next = resolveCentroVsIncrocioCentro(index, cols, rows, edificiInMappa, final);
        if (final.get(index) !== next) {
          final.set(index, next);
          changed = true;
        }
      }
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      if (edificiInMappa[index]?.nome !== "Strada") continue;
      final.set(
        index,
        fixStradaAdjacentToInvalidTerrain(
          index,
          cols,
          rows,
          terrenoInMappa,
          fixStradaCentroAdjacentToErba(index, cols, rows, terrenoInMappa, edificiInMappa, final.get(index) ?? "orizzontale")
        )
      );
    }
  }

  return (index: number) => final.get(index) ?? "orizzontale";
}

/** Sprite erba 1×1 (sostituisce il motivo 2×2 del foglio). */
export type ErbaTileAsset1x1 = "centro" | "campo_nord_est";

function isErbaCell(
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, { nome?: string }>
): boolean {
  return isErbaPlainCell(index, cols, rows, terrenoInMappa, edificiInMappa);
}

/**
 * Celle erba interne: `erba_centro_1x1` solo lontano da acqua e sabbia (bordi → `erba_spiaggia_*`).
 */
export function buildErbaAssetLookup(
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, { nome?: string }>,
  _stradaAssetAt: (index: number) => StradaTileAsset1x1
): (index: number) => ErbaTileAsset1x1 | undefined {
  return (index: number) => {
    if (!isErbaCell(index, cols, rows, terrenoInMappa, edificiInMappa)) return undefined;
    if (hasWaterCardinalNeighbor(index, cols, rows, terrenoInMappa)) return undefined;
    if (hasSandCardinalNeighbor(index, cols, rows, terrenoInMappa)) return undefined;
    return "centro";
  };
}

/** Decorazioni opzionali su erba piena (`tallGrass.png` / `sprout.png`). */
export type ErbaExtraDecorKind = "tallGrass" | "sprout";

/**
 * Sceglie in modo stabile (stesso indice → stesso risultato) se mostrare erba alta o germoglio.
 * Solo ~5% + ~5% delle celle idonee, così il verde resta leggibile.
 */
export function erbaExtraDecorCasuale(index: number, cols: number): ErbaExtraDecorKind | null {
  const col = index % cols;
  const row = Math.floor(index / cols);
  const h = ((row * 1337 + col * 4243 + index * 17) >>> 0) % 100;
  if (h < 5) return "tallGrass";
  if (h < 10) return "sprout";
  return null;
}

/**
 * Celle erba confinanti con sabbia: maschera autotile 3×3 → asset PNG `erba_spiaggia_*`.
 */
export function getGrassSandBorderSubtileIfAny(
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, { nome?: string }>
): Tile3x3Index | undefined {
  if ((terrenoInMappa[index] ?? "erba") !== "erba") return undefined;
  const col = index % cols;
  const row = Math.floor(index / cols);
  /**
   * Sopra la fascia “erba buffer → strada”: il vicino sotto è ancora erba, non Strada, quindi
   * senza questa regola la sabbia in diagonale attiva l’angolo erba–sabbia al posto di `erba_centro`.
   * Se a nord c’è già sabbia (costa), il bordo sabbia resta consentito.
   */
  let stradaDueRigheSotto = false;
  for (const dc of [-1, 0, 1] as const) {
    const c2 = col + dc;
    if (c2 < 0 || c2 >= cols) continue;
    if (row + 2 < rows && isStradaCell(row + 2, c2, cols, rows, edificiInMappa)) {
      stradaDueRigheSotto = true;
      break;
    }
  }
  const n = isSandAt(row - 1, col, cols, rows, terrenoInMappa);
  if (stradaDueRigheSotto && !n) {
    return undefined;
  }
  const e = isSandAt(row, col + 1, cols, rows, terrenoInMappa);
  const s = isSandAt(row + 1, col, cols, rows, terrenoInMappa);
  const w = isSandAt(row, col - 1, cols, rows, terrenoInMappa);
  if (n || e || s || w) {
    const mask = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);
    return subtile9FromMask(mask);
  }
  /**
   * Solo sabbia in diagonale (nessun vicino ortogonale sabbia): angolo interno autotile.
   * NW→6, NE→5, SW→7, SE→8.
   */
  const nw = isSandAt(row - 1, col - 1, cols, rows, terrenoInMappa);
  const ne = isSandAt(row - 1, col + 1, cols, rows, terrenoInMappa);
  const sw = isSandAt(row + 1, col - 1, cols, rows, terrenoInMappa);
  const se = isSandAt(row + 1, col + 1, cols, rows, terrenoInMappa);
  const dCount = (nw ? 1 : 0) + (ne ? 1 : 0) + (sw ? 1 : 0) + (se ? 1 : 0);
  if (dCount !== 1) return undefined;
  if (nw) return 6;
  if (ne) return 5;
  if (sw) return 7;
  if (se) return 8;
  return undefined;
}

/**
 * Lato sabbia verso erba: la transizione è sul tile `erba_spiaggia_*` (erba).
 * La sabbia adiacente resta `centro` (piena) salvo autotile verso mare/fiume.
 */
const SPIAGGIA_OK_VERSO_ERBA = new Set<SpiaggiaTileAsset1x1>(["centro"]);

/** Lati verso sabbia di ogni `erba_spiaggia_*`: solo `spiaggia_centro` o il bordo coerente. */
function erbaSpiaggiaSandSideWhitelist(
  asset: ErbaSpiaggiaTileAsset1x1,
  side: "n" | "s" | "e" | "w"
): Set<SpiaggiaTileAsset1x1> | null {
  switch (asset) {
    case "nord":
      return side === "n" ? SPIAGGIA_OK_VERSO_ERBA : null;
    case "sud":
      return side === "s" ? SPIAGGIA_OK_VERSO_ERBA : null;
    case "est":
      return side === "e" ? SPIAGGIA_OK_VERSO_ERBA : null;
    case "ovest":
      return side === "w" ? SPIAGGIA_OK_VERSO_ERBA : null;
    case "nord_est":
      if (side === "n") return SPIAGGIA_OK_VERSO_ERBA;
      if (side === "e") return SPIAGGIA_OK_VERSO_ERBA;
      return null;
    case "nord_ovest":
      if (side === "n") return SPIAGGIA_OK_VERSO_ERBA;
      if (side === "w") return SPIAGGIA_OK_VERSO_ERBA;
      return null;
    case "sud_est":
      if (side === "s") return SPIAGGIA_OK_VERSO_ERBA;
      if (side === "e") return SPIAGGIA_OK_VERSO_ERBA;
      return null;
    case "sud_ovest":
      if (side === "s") return SPIAGGIA_OK_VERSO_ERBA;
      if (side === "w") return SPIAGGIA_OK_VERSO_ERBA;
      return null;
    default:
      return null;
  }
}

function intersectSpiaggiaAllowed(
  a: Set<SpiaggiaTileAsset1x1>,
  b: Set<SpiaggiaTileAsset1x1>
): Set<SpiaggiaTileAsset1x1> {
  const out = new Set<SpiaggiaTileAsset1x1>();
  for (const x of a) {
    if (b.has(x)) out.add(x);
  }
  return out;
}

/** Lati con grafica acqua sui PNG spiaggia (allineati allo sheet 768–896, 128–256). */
const SPIAGGIA_WATER_EDGE_MASK: Record<SpiaggiaTileAsset1x1, number> = {
  centro: 0,
  nord: 1,
  sud: 4,
  est: 2,
  ovest: 8,
  nord_est: 3,
  nord_ovest: 9,
  sud_est: 6,
  sud_ovest: 12
};

function waterNeighborMaskAt(
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>
): number {
  const col = index % cols;
  const row = Math.floor(index / cols);
  return (
    (isWaterAt(row - 1, col, cols, rows, terrenoInMappa) ? 1 : 0) |
    (isWaterAt(row, col + 1, cols, rows, terrenoInMappa) ? 2 : 0) |
    (isWaterAt(row + 1, col, cols, rows, terrenoInMappa) ? 4 : 0) |
    (isWaterAt(row, col - 1, cols, rows, terrenoInMappa) ? 8 : 0)
  );
}

/** Il tile spiaggia deve mostrare acqua solo dove c’è mare/fiume adiacente. */
function spiaggiaAssetMatchesWaterNeighbors(
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  asset: SpiaggiaTileAsset1x1
): boolean {
  return SPIAGGIA_WATER_EDGE_MASK[asset] === waterNeighborMaskAt(index, cols, rows, terrenoInMappa);
}

function filterSpiaggiaByWaterMask(
  allowed: Set<SpiaggiaTileAsset1x1>,
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>
): Set<SpiaggiaTileAsset1x1> {
  const out = new Set<SpiaggiaTileAsset1x1>();
  for (const asset of allowed) {
    if (spiaggiaAssetMatchesWaterNeighbors(index, cols, rows, terrenoInMappa, asset)) {
      out.add(asset);
    }
  }
  return out;
}

function clampSpiaggiaAssetToWaterNeighbors(
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  asset: SpiaggiaTileAsset1x1
): SpiaggiaTileAsset1x1 {
  const waterMask = waterNeighborMaskAt(index, cols, rows, terrenoInMappa);
  if (waterMask === 0) {
    return "centro";
  }
  if (spiaggiaAssetMatchesWaterNeighbors(index, cols, rows, terrenoInMappa, asset)) {
    return asset;
  }
  const grezzo = getSpiaggiaAsset1x1Grezzo(index, cols, rows, terrenoInMappa);
  if (spiaggiaAssetMatchesWaterNeighbors(index, cols, rows, terrenoInMappa, grezzo)) {
    return grezzo;
  }
  return "centro";
}

function pickSpiaggiaFromAllowed(
  allowed: Set<SpiaggiaTileAsset1x1>,
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>
): SpiaggiaTileAsset1x1 {
  const waterOk = filterSpiaggiaByWaterMask(allowed, index, cols, rows, terrenoInMappa);
  const pool = waterOk.size > 0 ? waterOk : allowed;
  const preferred = getSpiaggiaAsset1x1Grezzo(index, cols, rows, terrenoInMappa);
  if (pool.has(preferred) && spiaggiaAssetMatchesWaterNeighbors(index, cols, rows, terrenoInMappa, preferred)) {
    return preferred;
  }
  if (pool.has("centro")) return "centro";
  for (const asset of pool) {
    if (spiaggiaAssetMatchesWaterNeighbors(index, cols, rows, terrenoInMappa, asset)) {
      return asset;
    }
  }
  return clampSpiaggiaAssetToWaterNeighbors(index, cols, rows, terrenoInMappa, "centro");
}

function isValidErbaSpiaggiaPlacement(
  index: number,
  cols: number,
  rows: number,
  asset: ErbaSpiaggiaTileAsset1x1,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, { nome?: string }>,
  spiaggiaAssetAt: (index: number) => SpiaggiaTileAsset1x1
): boolean {
  const col = index % cols;
  const row = Math.floor(index / cols);

  const checkSide = (
    side: "n" | "s" | "e" | "w",
    sandIndex: number
  ): boolean => {
    const wl = erbaSpiaggiaSandSideWhitelist(asset, side);
    if (wl == null) return true;
    if (!isSandAt(Math.floor(sandIndex / cols), sandIndex % cols, cols, rows, terrenoInMappa)) {
      return false;
    }
    return wl.has(spiaggiaAssetAt(sandIndex));
  };

  if (row > 0 && !checkSide("n", index - cols)) return false;
  if (row < rows - 1 && !checkSide("s", index + cols)) return false;
  if (col < cols - 1 && !checkSide("e", index + 1)) return false;
  if (col > 0 && !checkSide("w", index - 1)) return false;
  return true;
}

function fixSpiaggiaAdjacentToErbaSpiaggia(
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, { nome?: string }>,
  asset: SpiaggiaTileAsset1x1,
  erbaSpiaggiaLookup: Map<number, ErbaSpiaggiaTileAsset1x1>
): SpiaggiaTileAsset1x1 {
  const col = index % cols;
  const row = Math.floor(index / cols);
  let allowed: Set<SpiaggiaTileAsset1x1> | null = null;

  const addFromErba = (erbaIndex: number, sandSideFromErba: "n" | "s" | "e" | "w") => {
    if (!isErbaPlainCell(erbaIndex, cols, rows, terrenoInMappa, edificiInMappa)) return;
    const erbaAsset = erbaSpiaggiaLookup.get(erbaIndex);
    if (erbaAsset == null) return;
    const req = erbaSpiaggiaSandSideWhitelist(erbaAsset, sandSideFromErba);
    if (req == null) return;
    allowed = allowed == null ? new Set(req) : intersectSpiaggiaAllowed(allowed, req);
  };

  if (row > 0) addFromErba(index - cols, "s");
  if (row < rows - 1) addFromErba(index + cols, "n");
  if (col < cols - 1) addFromErba(index + 1, "w");
  if (col > 0) addFromErba(index - 1, "e");

  if (allowed == null || allowed.size === 0) {
    return clampSpiaggiaAssetToWaterNeighbors(index, cols, rows, terrenoInMappa, asset);
  }
  const waterOk = filterSpiaggiaByWaterMask(allowed, index, cols, rows, terrenoInMappa);
  if (waterOk.size === 0) {
    return clampSpiaggiaAssetToWaterNeighbors(index, cols, rows, terrenoInMappa, asset);
  }
  if (waterOk.has(asset) && spiaggiaAssetMatchesWaterNeighbors(index, cols, rows, terrenoInMappa, asset)) {
    return asset;
  }
  return pickSpiaggiaFromAllowed(waterOk, index, cols, rows, terrenoInMappa);
}

/**
 * Lookup sabbia/spiaggia: autotile acqua + vincoli da `erba_spiaggia_*` adiacenti.
 */
export function buildSpiaggiaAssetLookup(
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, { nome?: string }>,
  erbaSpiaggiaLookup: Map<number, ErbaSpiaggiaTileAsset1x1>
): (index: number) => SpiaggiaTileAsset1x1 {
  const final = new Map<number, SpiaggiaTileAsset1x1>();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      if ((terrenoInMappa[index] ?? "erba") !== "sabbia") continue;
      final.set(index, getSpiaggiaAsset1x1Grezzo(index, cols, rows, terrenoInMappa));
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const index = row * cols + col;
        if ((terrenoInMappa[index] ?? "erba") !== "sabbia") continue;
        const next = fixSpiaggiaAdjacentToErbaSpiaggia(
          index,
          cols,
          rows,
          terrenoInMappa,
          edificiInMappa,
          final.get(index) ?? "centro",
          erbaSpiaggiaLookup
        );
        if (final.get(index) !== next) {
          final.set(index, next);
          changed = true;
        }
      }
    }
  }

  return (index: number) => {
    const asset = final.get(index) ?? "centro";
    return clampSpiaggiaAssetToWaterNeighbors(index, cols, rows, terrenoInMappa, asset);
  };
}

/**
 * Celle erba confinanti con sabbia: PNG `erba_spiaggia_*` con vicini sabbia ammessi.
 */
export function buildErbaSpiaggiaAssetLookup(
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, { nome?: string }>,
  spiaggiaAssetAt: (index: number) => SpiaggiaTileAsset1x1
): (index: number) => ErbaSpiaggiaTileAsset1x1 | undefined {
  const final = new Map<number, ErbaSpiaggiaTileAsset1x1>();
  let changed = true;

  while (changed) {
    changed = false;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const index = row * cols + col;
        if (!isErbaPlainCell(index, cols, rows, terrenoInMappa, edificiInMappa)) continue;

        const subtile = getGrassSandBorderSubtileIfAny(index, cols, rows, terrenoInMappa, edificiInMappa);
        if (subtile == null || subtile === 4) {
          if (final.has(index)) {
            final.delete(index);
            changed = true;
          }
          continue;
        }

        const candidate = erbaSpiaggiaAssetFromGrassSandSubtile(subtile);
        const valid = isValidErbaSpiaggiaPlacement(
          index,
          cols,
          rows,
          candidate,
          terrenoInMappa,
          edificiInMappa,
          spiaggiaAssetAt
        );
        const had = final.get(index);

        if (valid && had !== candidate) {
          final.set(index, candidate);
          changed = true;
        } else if (!valid && had != null) {
          final.delete(index);
          changed = true;
        }
      }
    }
  }

  return (index: number) => final.get(index);
}

/** Lookup congiunti erba–spiaggia / spiaggia (convergenza a punti fissi). */
export function buildCoastalAssetLookups(
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, { nome?: string }>
): {
  erbaSpiaggiaAssetAt: (index: number) => ErbaSpiaggiaTileAsset1x1 | undefined;
  spiaggiaAssetAt: (index: number) => SpiaggiaTileAsset1x1;
} {
  const erbaSpiaggiaMap = new Map<number, ErbaSpiaggiaTileAsset1x1>();
  const spiaggiaMap = new Map<number, SpiaggiaTileAsset1x1>();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      if ((terrenoInMappa[index] ?? "erba") !== "sabbia") continue;
      spiaggiaMap.set(index, getSpiaggiaAsset1x1Grezzo(index, cols, rows, terrenoInMappa));
    }
  }

  for (let round = 0; round < 16; round++) {
    let changed = false;

    const erbaLookupFn = buildErbaSpiaggiaAssetLookup(
      cols,
      rows,
      terrenoInMappa,
      edificiInMappa,
      (i) => spiaggiaMap.get(i) ?? "centro"
    );
    const nextErba = new Map<number, ErbaSpiaggiaTileAsset1x1>();
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const index = row * cols + col;
        const asset = erbaLookupFn(index);
        if (asset != null) nextErba.set(index, asset);
      }
    }
    if (nextErba.size !== erbaSpiaggiaMap.size) {
      changed = true;
    } else {
      for (const [k, v] of nextErba) {
        if (erbaSpiaggiaMap.get(k) !== v) {
          changed = true;
          break;
        }
      }
      if (!changed) {
        for (const k of erbaSpiaggiaMap.keys()) {
          if (!nextErba.has(k)) {
            changed = true;
            break;
          }
        }
      }
    }
    erbaSpiaggiaMap.clear();
    for (const [k, v] of nextErba) erbaSpiaggiaMap.set(k, v);

    const spiaggiaLookupFn = buildSpiaggiaAssetLookup(
      cols,
      rows,
      terrenoInMappa,
      edificiInMappa,
      erbaSpiaggiaMap
    );
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const index = row * cols + col;
        if ((terrenoInMappa[index] ?? "erba") !== "sabbia") continue;
        const next = spiaggiaLookupFn(index);
        if (spiaggiaMap.get(index) !== next) {
          spiaggiaMap.set(index, next);
          changed = true;
        }
      }
    }

    if (!changed) break;
  }

  /** Erba confinante con sabbia: sempre `erba_spiaggia_*`, mai `erba_centro_1x1`. */
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      if (!isErbaPlainCell(index, cols, rows, terrenoInMappa, edificiInMappa)) continue;
      if (!hasSandCardinalNeighbor(index, cols, rows, terrenoInMappa)) continue;
      if (erbaSpiaggiaMap.has(index)) continue;
      const subtile = getGrassSandBorderSubtileIfAny(index, cols, rows, terrenoInMappa, edificiInMappa);
      if (subtile == null || subtile === 4) continue;
      erbaSpiaggiaMap.set(index, erbaSpiaggiaAssetFromGrassSandSubtile(subtile));
    }
  }

  for (const [index, asset] of spiaggiaMap) {
    spiaggiaMap.set(
      index,
      clampSpiaggiaAssetToWaterNeighbors(index, cols, rows, terrenoInMappa, asset)
    );
  }

  return {
    erbaSpiaggiaAssetAt: (index: number) => erbaSpiaggiaMap.get(index),
    spiaggiaAssetAt: (index: number) => {
      const asset = spiaggiaMap.get(index) ?? "centro";
      return clampSpiaggiaAssetToWaterNeighbors(index, cols, rows, terrenoInMappa, asset);
    }
  };
}
