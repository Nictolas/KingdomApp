import type { Abitante, Edificio } from "../types";
import type { EdificioInCellaMappa, MappaRuntimeState } from "./mappaTypes";
import type { TerrenoType } from "./riverGeneration";
import { getMappaSessione, setMappaSessione } from "./mappaSessione";

export const MAP_COLS = 50;
export const MAP_ROWS = 50;

export const RELIGIONI_CON_CULTO = ["Culto del Sole", "Culto degli Alieni"] as const;
export type ReligioneConCulto = (typeof RELIGIONI_CON_CULTO)[number];

export const TEMPLATE_ID_LUOGO_CULTO: Record<ReligioneConCulto, number> = {
  "Culto del Sole": 30,
  "Culto degli Alieni": 31
};

export function nomeEdificioLuogoCulto(religione: ReligioneConCulto): string {
  return religione === "Culto del Sole" ? "Luogo di Culto del Sole" : "Luogo di Culto degli Alieni";
}

export function emojiLuogoCulto(religione: ReligioneConCulto): string {
  return religione === "Culto del Sole" ? "☀️" : "👽";
}

/** Istanze costruite nel modello edifici ma ancora assenti dalla mappa. */
export function trovaLuoghiCultoDaPiazzareSuMappa(
  edifici: Edificio[],
  mappa?: MappaRuntimeState | null
): { religione: ReligioneConCulto; edificioGlobaleId: number }[] {
  const session = mappa ?? getMappaSessione();
  const idsSuMappa = new Set<number>();
  if (session) {
    for (const e of Object.values(session.edificiInMappa)) {
      if (e.edificioGlobaleId != null) idsSuMappa.add(e.edificioGlobaleId);
    }
  }
  const out: { religione: ReligioneConCulto; edificioGlobaleId: number }[] = [];
  for (const religione of RELIGIONI_CON_CULTO) {
    const nome = nomeEdificioLuogoCulto(religione);
    const templateId = TEMPLATE_ID_LUOGO_CULTO[religione];
    const istanza = edifici.find((e) => e.nome === nome && e.id !== templateId);
    if (istanza && !idsSuMappa.has(istanza.id)) {
      out.push({ religione, edificioGlobaleId: istanza.id });
    }
  }
  return out;
}

/** True se esiste un'istanza costruita (non il solo template di catalogo) o il blocco sulla mappa. */
export function haLuogoCulto(
  religione: ReligioneConCulto,
  edifici: Edificio[],
  mappa?: MappaRuntimeState | null
): boolean {
  const nome = nomeEdificioLuogoCulto(religione);
  const templateId = TEMPLATE_ID_LUOGO_CULTO[religione];
  if (edifici.some((e) => e.nome === nome && e.id !== templateId)) return true;
  const session = mappa ?? getMappaSessione();
  if (!session) return false;
  return Object.values(session.edificiInMappa).some((e) => e.nome === nome);
}

export type CapiReligiosiIds = {
  sole: number | null;
  alieni: number | null;
};

function raccogliCapiReligiosi(abitanti: Abitante[], capiIds?: CapiReligiosiIds): Abitante[] {
  const visti = new Set<number>();
  const out: Abitante[] = [];
  const aggiungi = (a: Abitante | undefined) => {
    if (!a || visti.has(a.id)) return;
    visti.add(a.id);
    out.push(a);
  };

  for (const a of abitanti) {
    if (a.lavoro === "Capo Religioso") aggiungi(a);
  }
  if (capiIds?.sole != null) aggiungi(abitanti.find((a) => a.id === capiIds.sole));
  if (capiIds?.alieni != null) aggiungi(abitanti.find((a) => a.id === capiIds.alieni));

  return out;
}

export function trovaCapoReligiosoSenzaLuogo(
  abitanti: Abitante[],
  edifici: Edificio[],
  mappa?: MappaRuntimeState | null,
  capiIds?: CapiReligiosiIds
): Abitante | null {
  for (const a of raccogliCapiReligiosi(abitanti, capiIds)) {
    const religione =
      a.id === capiIds?.sole
        ? "Culto del Sole"
        : a.id === capiIds?.alieni
          ? "Culto degli Alieni"
          : a.religione;
    if (!RELIGIONI_CON_CULTO.includes(religione as ReligioneConCulto)) continue;
    const religioneCulto = religione as ReligioneConCulto;
    if (!haLuogoCulto(religioneCulto, edifici, mappa)) return { ...a, religione: religioneCulto };
  }
  return null;
}

function getIndiciFootprint(anchor: number, w: number, h: number, cols: number): number[] {
  const ac = anchor % cols;
  const ar = Math.floor(anchor / cols);
  const out: number[] = [];
  for (let dr = 0; dr < h; dr++) {
    for (let dc = 0; dc < w; dc++) {
      out.push((ar + dr) * cols + (ac + dc));
    }
  }
  return out;
}

function isAcqua(index: number, cols: number, rows: number): boolean {
  const row = Math.floor(index / cols);
  const col = index % cols;
  return row === 0 || row === rows - 1 || col === 0 || col === cols - 1;
}

function riverSetDaTerreno(terreno: Record<number, TerrenoType>): Set<number> {
  const s = new Set<number>();
  for (const [k, v] of Object.entries(terreno)) {
    if (v === "river") s.add(Number(k));
  }
  return s;
}

function getVicini8(index: number, cols: number, rows: number): number[] {
  const c = index % cols;
  const r = Math.floor(index / cols);
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r2 = r + dr;
      const c2 = c + dc;
      if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
      out.push(r2 * cols + c2);
    }
  }
  return out;
}

function haVicinoFiume(index: number, riverSet: Set<number>, cols: number, rows: number): boolean {
  return getVicini8(index, cols, rows).some((n) => riverSet.has(n));
}

function getIndiciCuscinoErba(anchor: number, w: number, h: number, cols: number, rows: number): number[] {
  const ac = anchor % cols;
  const ar = Math.floor(anchor / cols);
  const foot = new Set(getIndiciFootprint(anchor, w, h, cols));
  const out: number[] = [];
  for (let dr = -1; dr <= h; dr++) {
    for (let dc = -1; dc <= w; dc++) {
      const inside = dr >= 0 && dr < h && dc >= 0 && dc < w;
      if (inside) continue;
      const r = ar + dr;
      const c = ac + dc;
      if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
      const i = r * cols + c;
      if (!foot.has(i)) out.push(i);
    }
  }
  return out;
}

function cellaSoloErba(index: number, cols: number, rows: number, riverSet: Set<number>): boolean {
  if (isAcqua(index, cols, rows) || riverSet.has(index)) return false;
  if (haVicinoFiume(index, riverSet, cols, rows)) return false;
  return true;
}

function estendiVietatoConFootprintECuscino(
  anchor: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
  vietato: Set<number>
): void {
  for (const i of getIndiciFootprint(anchor, w, h, cols)) vietato.add(i);
  for (const i of getIndiciCuscinoErba(anchor, w, h, cols, rows)) vietato.add(i);
}

function vietatoFootprintECuscinoDaEdifici(
  edifici: Record<number, EdificioInCellaMappa>,
  cols: number,
  rows: number
): Set<number> {
  const vietato = new Set<number>();
  for (const idxStr of Object.keys(edifici)) {
    const idx = Number(idxStr);
    const e = edifici[idx];
    if (!e || e.footprintRef != null) continue;
    if (e.footprint) {
      estendiVietatoConFootprintECuscino(idx, e.footprint.w, e.footprint.h, cols, rows, vietato);
    } else {
      estendiVietatoConFootprintECuscino(idx, 1, 1, cols, rows, vietato);
    }
  }
  return vietato;
}

function puòPiazzareFootprintConCuscino(
  anchor: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
  riverSet: Set<number>,
  vietato: Set<number>
): boolean {
  const ac = anchor % cols;
  const ar = Math.floor(anchor / cols);
  if (ac + w > cols || ar + h > rows) return false;
  for (let dr = 0; dr < h; dr++) {
    for (let dc = 0; dc < w; dc++) {
      const i = (ar + dr) * cols + (ac + dc);
      if (vietato.has(i) || isAcqua(i, cols, rows) || riverSet.has(i)) return false;
    }
  }
  for (const i of getIndiciCuscinoErba(anchor, w, h, cols, rows)) {
    if (vietato.has(i) || !cellaSoloErba(i, cols, rows, riverSet)) return false;
  }
  return true;
}

function trovaAnchorCasuale2x2(
  edificiInMappa: Record<number, EdificioInCellaMappa>,
  terrenoInMappa: Record<number, TerrenoType>,
  cols: number,
  rows: number
): number | null {
  const w = 2;
  const h = 2;
  const riverSet = riverSetDaTerreno(terrenoInMappa);
  const vietato = vietatoFootprintECuscinoDaEdifici(edificiInMappa, cols, rows);
  const candidati: number[] = [];
  for (let anchor = 0; anchor < cols * rows; anchor++) {
    if (puòPiazzareFootprintConCuscino(anchor, w, h, cols, rows, riverSet, vietato)) {
      candidati.push(anchor);
    }
  }
  if (candidati.length === 0) return null;
  return candidati[Math.floor(Math.random() * candidati.length)]!;
}

function applicaFootprint2x2(
  out: Record<number, EdificioInCellaMappa>,
  anchor: number,
  cols: number,
  base: { id: number; nome: string; emoji: string; edificioGlobaleId?: number }
): void {
  const w = 2;
  const h = 2;
  const celle = getIndiciFootprint(anchor, w, h, cols);
  out[anchor] = {
    id: base.id,
    nome: base.nome,
    emoji: "",
    footprint: { w, h },
    edificioGlobaleId: base.edificioGlobaleId
  };
  for (const i of celle) {
    if (i === anchor) continue;
    out[i] = {
      id: base.id,
      nome: base.nome,
      emoji: "",
      footprintRef: anchor,
      edificioGlobaleId: base.edificioGlobaleId
    };
  }
}

/** Piazza un Luogo di Culto 2×2 su erba libera (posto casuale). Restituisce true se riuscito. */
export function piazzaLuogoCultoSuMappa(
  religione: ReligioneConCulto,
  edificioGlobaleId: number,
  mappa?: MappaRuntimeState | null
): boolean {
  const session = mappa ?? getMappaSessione();
  if (!session) return false;

  const anchor = trovaAnchorCasuale2x2(session.edificiInMappa, session.terrenoInMappa, MAP_COLS, MAP_ROWS);
  if (anchor == null) return false;

  const nome = nomeEdificioLuogoCulto(religione);
  const emoji = emojiLuogoCulto(religione);
  const nextEdifici = { ...session.edificiInMappa };
  applicaFootprint2x2(nextEdifici, anchor, MAP_COLS, {
    id: TEMPLATE_ID_LUOGO_CULTO[religione],
    nome,
    emoji,
    edificioGlobaleId
  });

  setMappaSessione({ ...session, edificiInMappa: nextEdifici });
  return true;
}
