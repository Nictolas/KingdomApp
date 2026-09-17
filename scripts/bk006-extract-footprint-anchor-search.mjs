import fs from "node:fs";

const path = "app/mappa.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceExactlyOnce(from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`${label}: source block not found`);
  if (source.indexOf(from, first + from.length) >= 0) {
    throw new Error(`${label}: source block occurs more than once`);
  }
  source = source.replace(from, to);
}

replaceExactlyOnce(
`import {
  estendiVietatoConFootprintECuscino,
  puòPiazzareFootprintConCuscino
} from "../src/game/mappaPiazzamentoFootprint";`,
`import {
  estendiVietatoConFootprintECuscino,
  puòPiazzareFootprintConCuscino,
  trovaAnchorFootprintLibero,
  trovaCellaSingolaConCuscino
} from "../src/game/mappaPiazzamentoFootprint";`,
"footprint placement import"
);

replaceExactlyOnce(
`/** Primo angolo w×h con cuscino d'erba e rispetto di \`vietato\`, ordinato per vicinanza a \`preferred\`. */
function trovaAnchorFootprintLibero(
  w: number,
  h: number,
  preferred: number,
  cols: number,
  rows: number,
  riverSet: Set<number>,
  vietato: Set<number>
): number | null {
  const pc = preferred % cols;
  const pr = Math.floor(preferred / cols);
  const candidati = Array.from({ length: cols * rows }, (_, i) => i).sort((a, b) => {
    const ar = Math.floor(a / cols);
    const ac = a % cols;
    const br = Math.floor(b / cols);
    const bc = b % cols;
    return Math.abs(ar - pr) + Math.abs(ac - pc) - (Math.abs(br - pr) + Math.abs(bc - pc));
  });
  for (const anchor of candidati) {
    if (puòPiazzareFootprintConCuscino(anchor, w, h, cols, rows, riverSet, vietato)) return anchor;
  }
  return null;
}

/** Singola cella edificio 1×1 con stesso cuscino e \`vietato\`. */
function trovaCellaSingolaConCuscino(
  preferred: number,
  cols: number,
  rows: number,
  riverSet: Set<number>,
  vietato: Set<number>
): number | null {
  return trovaAnchorFootprintLibero(1, 1, preferred, cols, rows, riverSet, vietato);
}

`,
"",
"footprint anchor search helpers"
);

fs.writeFileSync(path, source);
