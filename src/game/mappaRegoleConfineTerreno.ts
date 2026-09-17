import type { TerrenoType } from "./riverGeneration";
import {
  applyTerrenoGrassAndSandContinuity,
  ensureStradaErbaTerrainBoundaryRules,
  fillErbaEnclosedByWater
} from "./riverGeneration";
import type { EdificioInCellaMappa } from "./mappaTypes";
import { giacimentoIndicesDaEdifici } from "./mappaEdificioFootprints";
import {
  assicuraEdificiCollegatiDaStrada,
  buildExcludeSandByRoads
} from "./roadConnectivity";
import { STRADA_OPZIONE } from "./mappaEdificiStatici";

/**
 * Applica in un solo passaggio le regole di coerenza tra terreno, acqua, sabbia e rete stradale.
 * La funzione muta gli oggetti ricevuti, mantenendo il comportamento storico di app/mappa.tsx.
 */
export function applicaRegoleConfineTerreno(
  edificiInMappa: Record<number, EdificioInCellaMappa>,
  terrenoInMappa: Record<number, TerrenoType>,
  cols: number,
  rows: number,
  options?: { collegaEdificiAllaStrada?: boolean }
): void {
  const giacimenti = giacimentoIndicesDaEdifici(edificiInMappa);
  const collegaEdifici = options?.collegaEdificiAllaStrada ?? true;

  ensureStradaErbaTerrainBoundaryRules(
    edificiInMappa,
    terrenoInMappa,
    cols,
    rows,
    giacimenti,
    collegaEdifici
      ? (edifici, terreno, c, r) =>
          assicuraEdificiCollegatiDaStrada(edifici, terreno, c, r, STRADA_OPZIONE)
      : () => {}
  );

  applyTerrenoGrassAndSandContinuity(
    terrenoInMappa,
    cols,
    rows,
    buildExcludeSandByRoads(edificiInMappa, terrenoInMappa, cols, rows, giacimenti)
  );
  fillErbaEnclosedByWater(terrenoInMappa, cols, rows);
}
