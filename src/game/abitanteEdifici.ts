import type { Abitante, Edificio } from "../types";
import { èResidenteFissoCastello, NOME_CASTELLO } from "./castelloGuardie";

/** Edificio di residenza dell'abitante, se assegnato. */
export function getEdificioAbitazione(abitanteId: number, edifici: Edificio[], abitante?: Abitante): Edificio | undefined {
  if (abitante && èResidenteFissoCastello(abitante)) {
    return edifici.find((e) => e.nome === NOME_CASTELLO);
  }
  return edifici.find(
    (e) => e.tipo === "Residenza" && (e.abitantiAssegnati ?? []).includes(abitanteId)
  );
}

/** Edifici non residenziali dove l'abitante lavora. */
export function getEdificiOccupazione(abitanteId: number, edifici: Edificio[]): Edificio[] {
  return edifici.filter(
    (e) => e.tipo !== "Residenza" && (e.abitantiAssegnati ?? []).includes(abitanteId)
  );
}

/** Nome dell'edificio di residenza dell'abitante, o "—" se nessuno. */
export function getAbitazioneAbitante(abitanteId: number, edifici: Edificio[]): string {
  return getEdificioAbitazione(abitanteId, edifici)?.nome ?? "—";
}

/** Nome dell'edificio dove l'abitante lavora (assegnazione non residenziale), o "—". */
export function getOccupazioneAbitante(abitanteId: number, edifici: Edificio[]): string {
  const postiLavoro = getEdificiOccupazione(abitanteId, edifici);
  if (postiLavoro.length === 0) return "—";
  return postiLavoro.map((e) => e.nome).join(", ");
}
