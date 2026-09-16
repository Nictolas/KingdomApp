import fs from "node:fs";

const mappaPath = "app/mappa.tsx";
const modulePath = "src/game/mappaEdificioFootprints.ts";
const testPath = "tests/mappa-edificio-footprints.test.ts";

let mappa = fs.readFileSync(mappaPath, "utf8");

const oldImport = 'import { EDIFICIO_TO_ROUTE } from "../src/game/mappaEdificioRoutes";\nimport { FOOTPRINT_COSTRUZIONE } from "../src/game/mappaCostruzioneFootprints";';
const newImport = 'import { EDIFICIO_TO_ROUTE } from "../src/game/mappaEdificioRoutes";\nimport {\n  dimensioniFootprintEdificioInMappa,\n  indiciFootprintProtettiIniziali\n} from "../src/game/mappaEdificioFootprints";';
if (!mappa.includes(oldImport)) throw new Error("Expected footprint import block not found");
mappa = mappa.replace(oldImport, newImport);

const dimensioniFn = `function dimensioniFootprintEdificioInMappa(
  anchor: number,
  edificiInMappa: Record<number, EdificioInCella>
): { w: number; h: number } {
  const cap = edificiInMappa[anchor];
  if (!cap) return { w: 1, h: 1 };
  if (cap.footprint) return cap.footprint;
  return FOOTPRINT_COSTRUZIONE[cap.nome] ?? { w: 1, h: 1 };
}

`;
if (!mappa.includes(dimensioniFn)) throw new Error("dimensioniFootprintEdificioInMappa block not found");
mappa = mappa.replace(dimensioniFn, "");

const protettiFn = `/** Celle occupate dagli edifici presenti allo stato iniziale della mappa (non demolibili). */
function indiciFootprintProtettiIniziali(
  edificiIniziali: Record<number, EdificioInCella>,
  cols: number
): Set<number> {
  const protetti = new Set<number>();
  for (const idxStr of Object.keys(edificiIniziali)) {
    const idx = Number(idxStr);
    const e = edificiIniziali[idx];
    if (!e || e.footprintRef != null) continue;
    const { w, h } = dimensioniFootprintEdificioInMappa(idx, edificiIniziali);
    for (const i of getIndiciFootprint(idx, w, h, cols)) protetti.add(i);
  }
  return protetti;
}

`;
if (!mappa.includes(protettiFn)) throw new Error("indiciFootprintProtettiIniziali block not found");
mappa = mappa.replace(protettiFn, "");
fs.writeFileSync(mappaPath, mappa);

fs.writeFileSync(modulePath, `import {
  FOOTPRINT_COSTRUZIONE,
  type MappaCostruzioneFootprint
} from "./mappaCostruzioneFootprints";
import { getIndiciFootprint } from "./mappaGeometry";

export type MappaEdificioFootprintEntry = {
  nome: string;
  footprintRef?: number;
  footprint?: MappaCostruzioneFootprint;
};

/** Dimensioni effettive del footprint di un edificio presente sulla mappa. */
export function dimensioniFootprintEdificioInMappa(
  anchor: number,
  edificiInMappa: Record<number, MappaEdificioFootprintEntry>
): MappaCostruzioneFootprint {
  const cap = edificiInMappa[anchor];
  if (!cap) return { w: 1, h: 1 };
  if (cap.footprint) return cap.footprint;
  return FOOTPRINT_COSTRUZIONE[cap.nome] ?? { w: 1, h: 1 };
}

/** Celle occupate dagli edifici iniziali e quindi protette dalla demolizione. */
export function indiciFootprintProtettiIniziali(
  edificiIniziali: Record<number, MappaEdificioFootprintEntry>,
  cols: number
): Set<number> {
  const protetti = new Set<number>();
  for (const idxStr of Object.keys(edificiIniziali)) {
    const idx = Number(idxStr);
    const e = edificiIniziali[idx];
    if (!e || e.footprintRef != null) continue;
    const { w, h } = dimensioniFootprintEdificioInMappa(idx, edificiIniziali);
    for (const i of getIndiciFootprint(idx, w, h, cols)) protetti.add(i);
  }
  return protetti;
}
`);

fs.writeFileSync(testPath, `import assert from "node:assert/strict";
import test from "node:test";

import {
  dimensioniFootprintEdificioInMappa,
  indiciFootprintProtettiIniziali,
  type MappaEdificioFootprintEntry
} from "../src/game/mappaEdificioFootprints.ts";

test("dimensioniFootprintEdificioInMappa privilegia il footprint esplicito", () => {
  const edifici: Record<number, MappaEdificioFootprintEntry> = {
    6: { nome: "Serra", footprint: { w: 3, h: 2 } }
  };
  assert.deepEqual(dimensioniFootprintEdificioInMappa(6, edifici), { w: 3, h: 2 });
});

test("dimensioniFootprintEdificioInMappa usa la tabella statica e il fallback 1x1", () => {
  const edifici: Record<number, MappaEdificioFootprintEntry> = {
    6: { nome: "Serra" },
    12: { nome: "Dormitorio" },
    18: { nome: "Edificio sconosciuto" }
  };
  assert.deepEqual(dimensioniFootprintEdificioInMappa(6, edifici), { w: 2, h: 1 });
  assert.deepEqual(dimensioniFootprintEdificioInMappa(12, edifici), { w: 2, h: 2 });
  assert.deepEqual(dimensioniFootprintEdificioInMappa(18, edifici), { w: 1, h: 1 });
  assert.deepEqual(dimensioniFootprintEdificioInMappa(24, edifici), { w: 1, h: 1 });
});

test("indiciFootprintProtettiIniziali espande solo le celle anchor", () => {
  const edifici: Record<number, MappaEdificioFootprintEntry> = {
    6: { nome: "Serra", footprint: { w: 2, h: 1 } },
    7: { nome: "Serra", footprintRef: 6 },
    12: { nome: "Dormitorio" },
    13: { nome: "Dormitorio", footprintRef: 12 },
    17: { nome: "Dormitorio", footprintRef: 12 },
    18: { nome: "Dormitorio", footprintRef: 12 },
    24: { nome: "Edificio sconosciuto" }
  };

  assert.deepEqual(
    [...indiciFootprintProtettiIniziali(edifici, 5)].sort((a, b) => a - b),
    [6, 7, 12, 13, 17, 18, 24]
  );
});
`);
