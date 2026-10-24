import type { Abitante, Edificio } from "../types";
import type { ModalitaRe } from "./reModalita";
import type { CommuteInfoMappa } from "./mappaPersonaggiRuntimeStore";
import { èResidenteFissoCastello, NOME_CASTELLO } from "./castelloGuardie";
import { ID_GIOCATORE } from "./schiavituCommercio";

/**
 * Il Castello è la casa del Re, del Consigliere e dei Nobili che vi sono assegnati.
 * Non è una residenza piazzabile sulla griglia: lo stato del Re è esplicito,
 * mentre gli altri residenti del Castello rientrano alla routine notturna.
 * Le Guardie non sono residenti fissi solo perché lavorano al Castello.
 */
export function abitanteNelCastelloDiNotte(
  abitante: Abitante,
  edifici: readonly Edificio[],
  modalitaRe: ModalitaRe
): boolean {
  const castello = edifici.find((e) => e.nome === NOME_CASTELLO && e.stato === "Operativo");
  if (!castello) return false;
  if (abitante.id === ID_GIOCATORE) return modalitaRe === "nel_castello";
  return (
    èResidenteFissoCastello(abitante) &&
    (castello.abitantiAssegnati ?? []).includes(abitante.id)
  );
}

export type StatoRientroNotturno = {
  notte: boolean;
  abitanti: readonly Abitante[];
  edifici: readonly Edificio[];
  modalitaRe: ModalitaRe;
  dormonoACasaIds: ReadonlySet<number>;
  cellaCasaPerAbitanteId: ReadonlyMap<number, number | null>;
  commuteByAbitanteId: Readonly<Record<number, CommuteInfoMappa>>;
};

/**
 * Accelera solo quando OGNI abitante è effettivamente al riparo nella propria
 * abitazione (o nel Castello), non mentre sta raggiungendola.
 * Un senzattetto, un Golem in giro, una Guardia fuori o il Re a giro
 * impediscono l'accelerazione. Evita anche il caso di popolazione vuota.
 */
export function tuttiGliAbitantiSonoACasaDiNotte(stato: StatoRientroNotturno): boolean {
  if (!stato.notte || stato.abitanti.length === 0) return false;
  return stato.abitanti.every((abitante) => {
    if (stato.commuteByAbitanteId[abitante.id] != null) return false;
    if (abitanteNelCastelloDiNotte(abitante, stato.edifici, stato.modalitaRe)) return true;
    // Il Re senza Castello/non nel Castello non può risultare a casa
    // tramite un'assegnazione accidentale a un'altra residenza.
    if (abitante.id === ID_GIOCATORE) return false;
    return (
      (stato.cellaCasaPerAbitanteId.get(abitante.id) ?? null) != null &&
      stato.dormonoACasaIds.has(abitante.id)
    );
  });
}
