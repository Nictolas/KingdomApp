import fs from "node:fs";

const path = "app/mappa.tsx";
let text = fs.readFileSync(path, "utf8");

const oldImport = 'import { estendiVietatoConFootprintECuscino } from "../src/game/mappaPiazzamentoFootprint";';
const newImport = `import {
  estendiVietatoConFootprintECuscino,
  puòPiazzareFootprintConCuscino
} from "../src/game/mappaPiazzamentoFootprint";`;
if (!text.includes(oldImport)) throw new Error("Expected mappaPiazzamentoFootprint import not found");
text = text.replace(oldImport, newImport);

const oldBlock = `/**
 * \`vietato\` = unione (footprint ∪ cuscino) degli edifici già piazzati: il nuovo blocco
 * non può invadere quell'area (mantiene almeno un anello d'erba tra strutture).
 */
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

`;
if (!text.includes(oldBlock)) throw new Error("Expected local puòPiazzareFootprintConCuscino block not found");
text = text.replace(oldBlock, "");

fs.writeFileSync(path, text);
