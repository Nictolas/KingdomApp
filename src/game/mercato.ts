import type { OrdineMercato, Risorsa } from "../types";

export type AggiungiOrdineMercatoInput = {
  tipo: "compra" | "vendi";
  risorsaId: number;
  quantità: number;
  prezzoUnitario: number;
  ordiniCorrenti: OrdineMercato[];
  risorse: Risorsa[];
  /** Saldo Tesoro (monete colonia). */
  moneteGiocatore: number;
};

export type AggiungiOrdineMercatoResult =
  | { success: false }
  | { success: true; nuovoOrdine: OrdineMercato };

/** Applica le regole di validazione e, se valide, restituisce un nuovo ordine di mercato. */
export function aggiungiOrdineMercatoPuro({
  tipo,
  risorsaId,
  quantità,
  prezzoUnitario,
  ordiniCorrenti,
  risorse,
  moneteGiocatore
}: AggiungiOrdineMercatoInput): AggiungiOrdineMercatoResult {
  if (quantità <= 0 || prezzoUnitario <= 0) {
    return { success: false };
  }

  const risorsa = risorse.find((r) => r.id === risorsaId);
  if (!risorsa || risorsa.nome === "Crediti") {
    return { success: false };
  }

  if (tipo === "compra") {
    const costo = quantità * prezzoUnitario;
    const moneteImpegnate = ordiniCorrenti
      .filter((o) => o.tipo === "compra")
      .reduce((s, o) => s + o.quantità * o.prezzoUnitario, 0);
    if (moneteGiocatore - moneteImpegnate < costo) {
      return { success: false };
    }
  } else {
    const qtàGiàInVendita = ordiniCorrenti
      .filter((o) => o.tipo === "vendi" && o.risorsaId === risorsaId)
      .reduce((s, o) => s + o.quantità, 0);
    if (risorsa.quantità - qtàGiàInVendita < quantità) {
      return { success: false };
    }
  }

  const newId =
    ordiniCorrenti.length === 0 ? 1 : Math.max(...ordiniCorrenti.map((o) => o.id)) + 1;

  return {
    success: true,
    nuovoOrdine: { id: newId, tipo, risorsaId, quantità, prezzoUnitario }
  };
}

/** Delta risorse materiali dovuto agli ordini (anteprima; il Tesoro è a parte). */
export function calcolaDeltaOrdiniMercatoPuro(
  ordiniMercato: OrdineMercato[],
  risorse: Risorsa[]
): Record<string, number> {
  const delta: Record<string, number> = {};

  ordiniMercato.forEach((ordine) => {
    const risorsa = risorse.find((r) => r.id === ordine.risorsaId);
    if (!risorsa || risorsa.nome === "Crediti") return;
    const nomeRisorsa = risorsa.nome;
    if (ordine.tipo === "compra") {
      delta[nomeRisorsa] = (delta[nomeRisorsa] ?? 0) + ordine.quantità;
    } else {
      delta[nomeRisorsa] = (delta[nomeRisorsa] ?? 0) - ordine.quantità;
    }
  });

  return delta;
}

/** Delta Tesoro (monete) dagli ordini di mercato in coda. */
export function calcolaDeltaTesoroOrdiniMercato(ordiniMercato: OrdineMercato[]): number {
  let delta = 0;
  for (const ordine of ordiniMercato) {
    const importo = ordine.quantità * ordine.prezzoUnitario;
    if (ordine.tipo === "compra") delta -= importo;
    else delta += importo;
  }
  return delta;
}
