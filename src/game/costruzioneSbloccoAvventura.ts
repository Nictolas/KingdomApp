/**
 * Catalogo Costruisci in Avventura: all’inizio solo poche voci;
 * il resto si sblocca tramite obiettivi (`sblocca: { tipo: "edificio", nomi }`).
 */

import { OBIETTIVI_CATALOGO } from "../data/obiettiviCatalogo";
import { NOME_PONTE } from "./ponteMappa";

/** Edifici/opzioni sempre disponibili in Avventura dall’inizio. */
export const NOMI_COSTRUZIONE_AVVENTURA_INIZIALI = new Set<string>([
  NOME_PONTE,
  "Serra",
  "Capanna"
]);

export type OpzioneCostruzioneSpeciale = "strada" | "ambiente";

/** True se in Creativa, o se il nome è sbloccato in Avventura. */
export function edificiCostruibiliSbloccati(
  obiettiviCompletati: readonly string[] | ReadonlySet<string>,
  modalitaGioco: "creativa" | "avventura"
): ReadonlySet<string> {
  if (modalitaGioco === "creativa") {
    return new Set(["*"]); // sentinella: tutto sbloccato
  }
  const set = new Set<string>(NOMI_COSTRUZIONE_AVVENTURA_INIZIALI);
  const completati =
    obiettiviCompletati instanceof Set ? obiettiviCompletati : new Set(obiettiviCompletati);
  for (const o of OBIETTIVI_CATALOGO) {
    if (!completati.has(o.id)) continue;
    if (o.sblocca?.tipo === "edificio") {
      for (const nome of o.sblocca.nomi) set.add(nome);
    }
  }
  return set;
}

export function isNomeEdificioCostruibileSbloccato(
  nome: string,
  sbloccati: ReadonlySet<string>
): boolean {
  return sbloccati.has("*") || sbloccati.has(nome);
}

export function isStradaCostruibileSbloccata(sbloccati: ReadonlySet<string>): boolean {
  return sbloccati.has("*") || sbloccati.has("Strada");
}

/** Terreni Ambiente (erba, acqua, …): sblocco dedicato o tutto in Creativa. */
export function isAmbienteCostruibileSbloccato(sbloccati: ReadonlySet<string>): boolean {
  return sbloccati.has("*") || sbloccati.has("Ambiente");
}
