export const FIXED_MAP_COLS = 50;
export const FIXED_MAP_ROWS = 50;

export const ADMIN_FOOTPRINT_W = 3;
export const ADMIN_FOOTPRINT_H = 2;
export const DORMITORIO_FOOTPRINT_W = 2;
export const DORMITORIO_FOOTPRINT_H = 2;
export const BAR_FOOTPRINT_W = 2;
export const BAR_FOOTPRINT_H = 2;
export const TRIBUNALE_FOOTPRINT_W = 2;
export const TRIBUNALE_FOOTPRINT_H = 2;
export const UFFICIO_IMMIGRAZIONE_FOOTPRINT_W = 2;
export const UFFICIO_IMMIGRAZIONE_FOOTPRINT_H = 2;
export const UFFICIO_EDILE_FOOTPRINT_W = 2;
export const UFFICIO_EDILE_FOOTPRINT_H = 2;
export const MERCATO_FOOTPRINT_W = 2;
export const MERCATO_FOOTPRINT_H = 2;
export const NEGOZIO_FOOTPRINT_W = 2;
export const NEGOZIO_FOOTPRINT_H = 2;
export const DISSALATORE_FOOTPRINT_W = 2;
export const DISSALATORE_FOOTPRINT_H = 2;
export const SPAZIOPORTO_FOOTPRINT_W = 4;
export const SPAZIOPORTO_FOOTPRINT_H = 3;
export const SERRA_FOOTPRINT_W = 2;
export const SERRA_FOOTPRINT_H = 1;
export const CAPANNA_FOOTPRINT_W = 2;
export const CAPANNA_FOOTPRINT_H = 1;
export const COSTRUZIONE_TERRENO_FOOTPRINT_W = 2;
export const COSTRUZIONE_TERRENO_FOOTPRINT_H = 2;

export const CELL_SIZE_PX = 40;
export const GAP = 0;
export const DOPPIO_TAP_MS = 400;

/** Calcola le posizioni preferite degli edifici iniziali rispetto al centro della griglia. */
export function getIndiciEdificiIniziali(cols: number, rows: number) {
  const centro = Math.floor((cols * rows) / 2) - Math.floor(cols / 2);
  return {
    CENTRO_COMANDO_INDEX: centro,
    SPAZIOPORTO_INDEX: centro + 1,
    TRIBUNALE_INDEX: centro + cols,
    SERRA_INDEX: centro - 1,
    SERRA_2_INDEX: centro - 4,
    DORMITORIO_1_INDEX: centro + 2,
    DORMITORIO_2_INDEX: centro - cols,
    DORMITORIO_3_INDEX: centro + cols + 1,
    BAR_INDEX: centro + 2 * cols + 3
  };
}
