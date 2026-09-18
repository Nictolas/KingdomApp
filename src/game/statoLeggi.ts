/**
 * Stato legge mostrato in UI: riflette i toggle/policy di gioco, non il catalogo statico.
 */

export type StatoLeggeUi = "Proposta" | "In vigore" | "Abrogata";

export type FlagsStatoLeggi = {
  penaDiMorteAttiva: boolean;
  leggeRazzialeAttiva: boolean;
  divietoEspatrioAttivo: boolean;
  iusPrimaeNoctisAttivo: boolean;
  coprifuocoAttivo: boolean;
  nudismoAttivo: boolean;
  /** Aliquota patrimonio; se assente si tratta come policy sempre attiva. */
  tassaPatrimonioPercentuale?: number;
  /** Aliquota IVA; se assente si tratta come policy sempre attiva. */
  ivaPercentuale?: number;
};

/** Leggi presenti in catalogo ma senza schermata né effetto di gioco. */
export const LEGGI_SENZA_EFFETTO = [
  "Carta dei Diritti dei Sudditi",
  "Regolamento sull'Uso dell'Energia"
] as const;

/**
 * Policy sempre configurabili (hanno schermata): risultano "In vigore".
 * Toggle on/off: "In vigore" solo se il flag è true, altrimenti "Proposta".
 * Tasse con aliquota: "In vigore" se % > 0, altrimenti "Proposta".
 * Leggi senza effetto: "Proposta".
 */
export function resolveStatoLegge(titolo: string, flags: FlagsStatoLeggi): StatoLeggeUi {
  if ((LEGGI_SENZA_EFFETTO as readonly string[]).includes(titolo)) {
    return "Proposta";
  }

  switch (titolo) {
    case "Pena di Morte":
      return flags.penaDiMorteAttiva ? "In vigore" : "Proposta";
    case "Legge Razziale":
      return flags.leggeRazzialeAttiva ? "In vigore" : "Proposta";
    case "Divieto di espatrio":
      return flags.divietoEspatrioAttivo ? "In vigore" : "Proposta";
    case "Ius primae noctis":
      return flags.iusPrimaeNoctisAttivo ? "In vigore" : "Proposta";
    case "Coprifuoco":
      return flags.coprifuocoAttivo ? "In vigore" : "Proposta";
    case "Nudismo":
      return flags.nudismoAttivo ? "In vigore" : "Proposta";
    case "Tassa sul Patrimonio":
      return (flags.tassaPatrimonioPercentuale ?? 0) > 0 ? "In vigore" : "Proposta";
    case "Imposta sul Valore Aggiunto":
      return (flags.ivaPercentuale ?? 0) > 0 ? "In vigore" : "Proposta";
    default:
      // Tassa reddito, nascite, religione, famiglie, droghe, età, sanità, reddito cittadinanza, …
      return "In vigore";
  }
}
