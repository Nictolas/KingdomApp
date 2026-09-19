/**
 * Sblocco tasse via obiettivi (progressione storica).
 * Prelievo Forzoso è sempre disponibile; Patrimonio → Reddito → IVA si sbloccano.
 */

import { OBIETTIVI_CATALOGO } from "../data/obiettiviCatalogo";

export type TassaId = "prelievo" | "patrimonio" | "reddito" | "iva";

export const TASSE_TITOLO_LEGGE: Record<Exclude<TassaId, "prelievo">, string> = {
  patrimonio: "Tassa sul Patrimonio",
  reddito: "Tassa sul Reddito",
  iva: "Imposta sul Valore Aggiunto"
};

export const TASSA_PRELIEVO_TITOLO = "Prelievo Forzoso";

/** Mappa obiettivo → tassa sbloccata (derivata dal catalogo). */
export function mappaObiettivoTassa(): Map<string, Exclude<TassaId, "prelievo">> {
  const map = new Map<string, Exclude<TassaId, "prelievo">>();
  for (const o of OBIETTIVI_CATALOGO) {
    if (o.sblocca?.tipo === "tassa") {
      map.set(o.id, o.sblocca.id);
    }
  }
  return map;
}

export type TasseSbloccate = ReadonlySet<TassaId>;

export function tasseSbloccate(
  obiettiviCompletati: readonly string[] | ReadonlySet<string>,
  modalitaGioco: "creativa" | "avventura"
): TasseSbloccate {
  if (modalitaGioco === "creativa") {
    return new Set<TassaId>(["prelievo", "patrimonio", "reddito", "iva"]);
  }
  const set = new Set<TassaId>(["prelievo"]);
  const completati =
    obiettiviCompletati instanceof Set ? obiettiviCompletati : new Set(obiettiviCompletati);
  for (const [obiettivoId, tassaId] of mappaObiettivoTassa()) {
    if (completati.has(obiettivoId)) set.add(tassaId);
  }
  return set;
}

export function isTassaSbloccata(
  tassaId: TassaId,
  obiettiviCompletati: readonly string[] | ReadonlySet<string>,
  modalitaGioco: "creativa" | "avventura"
): boolean {
  return tasseSbloccate(obiettiviCompletati, modalitaGioco).has(tassaId);
}

/** Titoli leggi fiscali soggette a sblocco (escluso Prelievo, sempre free). */
export function tassaIdDaTitoloLegge(titolo: string): TassaId | null {
  if (titolo === TASSA_PRELIEVO_TITOLO) return "prelievo";
  if (titolo === TASSE_TITOLO_LEGGE.patrimonio) return "patrimonio";
  if (titolo === TASSE_TITOLO_LEGGE.reddito) return "reddito";
  if (titolo === TASSE_TITOLO_LEGGE.iva) return "iva";
  return null;
}
