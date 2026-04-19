import type { TerrenoType } from "./riverGeneration";

function isAcquaCell(index: number, cols: number, rows: number): boolean {
  const row = Math.floor(index / cols);
  const col = index % cols;
  return row === 0 || row === rows - 1 || col === 0 || col === cols - 1;
}

function isWaterAt(
  row: number,
  col: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>
): boolean {
  if (row < 0 || row >= rows || col < 0 || col >= cols) return false;
  const index = row * cols + col;
  if (isAcquaCell(index, cols, rows)) return true;
  return (terrenoInMappa[index] ?? "erba") === "river";
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

/** Indice 0…3 nel blocco 2×2 (TL,TR,BL,BR). */
export type Tile2x2Index = 0 | 1 | 2 | 3;

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
  | "incrocio_centro";

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
  "incrocio_centro",
  "incrocio_est_sud_nord",
  "incrocio_nord_est_ovest",
  "incrocio_nord_est_sud",
  "sud",
  "verticale"
]);

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
  if (count === 0) return "orizzontale";
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
 * Lookup per indice cella: whitelist verso sud (sotto verticale/nord, sotto curva_sud_ovest o incrocio_est_sud_ovest) in ordine per righe.
 */
export function buildStradaAssetLookup(
  cols: number,
  rows: number,
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

  return (index: number) => final.get(index) ?? "orizzontale";
}

/**
 * Quale quarto del motivo erba 2×2 usare (ripetizione a scacchiera sulla mappa).
 */
export function getGrass2x2Index(index: number, cols: number): Tile2x2Index {
  const col = index % cols;
  const row = Math.floor(index / cols);
  return ((((row & 1) << 1) | (col & 1)) as Tile2x2Index);
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
 * Celle erba confinanti con strada: maschera come spiaggia/sabbia (strada = “feature” nel bitmask).
 * Ha priorità sulla fascia erba–sabbia se un vicino è strada.
 */
export function getGrassRoadBorderSubtileIfAny(
  index: number,
  cols: number,
  rows: number,
  terrenoInMappa: Record<number, TerrenoType>,
  edificiInMappa: Record<number, { nome?: string }>
): Tile3x3Index | undefined {
  if ((terrenoInMappa[index] ?? "erba") !== "erba") return undefined;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const n = isStradaCell(row - 1, col, cols, rows, edificiInMappa);
  const e = isStradaCell(row, col + 1, cols, rows, edificiInMappa);
  const s = isStradaCell(row + 1, col, cols, rows, edificiInMappa);
  const w = isStradaCell(row, col - 1, cols, rows, edificiInMappa);
  if (!n && !e && !s && !w) return undefined;
  const mask = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);
  return subtile9FromMask(mask);
}

/**
 * Celle erba confinanti con sabbia: stesso schema maschera della spiaggia (sabbia = “acqua” nel bitmask).
 * Se nessun vicino è sabbia, l’erba usa solo il motivo 2×2.
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
  if (
    isStradaCell(row - 1, col, cols, rows, edificiInMappa) ||
    isStradaCell(row, col + 1, cols, rows, edificiInMappa) ||
    isStradaCell(row + 1, col, cols, rows, edificiInMappa) ||
    isStradaCell(row, col - 1, cols, rows, edificiInMappa)
  ) {
    return undefined;
  }
  /**
   * Sopra la fascia “erba buffer → strada”: il vicino sotto è ancora erba, non Strada, quindi
   * non si applica il bordo erba–strada; senza questa regola la sabbia in diagonale attiva
   * l’angolo erba–sabbia al posto dell’erba centrale 2×2.
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
   * Solo sabbia in diagonale (nessun vicino ortogonale sabbia): “angolo interno” nel blocco 3×3.
   * Indici nel foglio grass–sabbia (320,128): NW→6, NE→5, SW→7, SE→8.
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
