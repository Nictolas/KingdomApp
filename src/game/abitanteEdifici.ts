import type { Edificio } from "../types";

/** Nome dell'edificio di residenza dell'abitante, o "—" se nessuno. */
export function getAbitazioneAbitante(abitanteId: number, edifici: Edificio[]): string {
  const residenza = edifici.find(
    (e) => e.tipo === "Residenza" && (e.abitantiAssegnati ?? []).includes(abitanteId)
  );
  return residenza?.nome ?? "—";
}

/** Nome dell'edificio dove l'abitante lavora (assegnazione non residenziale), o "—". */
export function getOccupazioneAbitante(abitanteId: number, edifici: Edificio[]): string {
  const postiLavoro = edifici.filter(
    (e) => e.tipo !== "Residenza" && (e.abitantiAssegnati ?? []).includes(abitanteId)
  );
  if (postiLavoro.length === 0) return "—";
  return postiLavoro.map((e) => e.nome).join(", ");
}
