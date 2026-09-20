import type { Abitante, Edificio } from "../types";
import { LAVORO_CONSIGLIERE } from "./consigliere";
import { NOME_CASTELLO } from "./castelloGuardie";
import type { ModalitaRe } from "./reModalita";

/** True se il Consigliere è assegnato al Castello (vive/lavora lì). */
export function consigliereAssegnatoAlCastello(
  abitante: Abitante | null | undefined,
  edifici: Edificio[]
): boolean {
  if (!abitante || abitante.lavoro !== LAVORO_CONSIGLIERE) return false;
  return edifici.some(
    (e) => e.nome === NOME_CASTELLO && (e.abitantiAssegnati ?? []).includes(abitante.id)
  );
}

/**
 * Il Consigliere resta nascosto nel Castello solo se assegnato, non in commute
 * e il Re non è «a giro» (allineato: a inizio partita tutti sono fuori).
 */
export function consigliereNascostoNelCastello(
  abitante: Abitante,
  edifici: Edificio[],
  inCommute: boolean,
  modalitaRe: ModalitaRe = "nel_castello"
): boolean {
  if (inCommute) return false;
  if (modalitaRe === "a_giro") return false;
  return consigliereAssegnatoAlCastello(abitante, edifici);
}
