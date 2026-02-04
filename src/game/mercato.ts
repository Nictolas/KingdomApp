import type { OrdineMercato, Risorsa } from "../types";

export type AggiungiOrdineMercatoInput = {
  tipo: "compra" | "vendi";
  risorsaId: number;
  quantità: number;
  prezzoUnitario: number;
  ordiniCorrenti: OrdineMercato[];
  risorse: Risorsa[];
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
  risorse
}: AggiungiOrdineMercatoInput): AggiungiOrdineMercatoResult {
  const creditiId = 1;
  if (risorsaId === creditiId || quantità <= 0 || prezzoUnitario <= 0) {
    return { success: false };
  }

  const crediti = risorse.find((r) => r.id === creditiId);
  const risorsa = risorse.find((r) => r.id === risorsaId);
  if (!crediti || !risorsa) {
    return { success: false };
  }

  if (tipo === "compra") {
    const costo = quantità * prezzoUnitario;
    const creditiImpegnati = ordiniCorrenti
      .filter((o) => o.tipo === "compra")
      .reduce((s, o) => s + o.quantità * o.prezzoUnitario, 0);
    if (crediti.quantità - creditiImpegnati < costo) {
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

/** Calcola il delta delle risorse dovuto agli ordini di mercato (anteprima). */
export function calcolaDeltaOrdiniMercatoPuro(
  ordiniMercato: OrdineMercato[],
  risorse: Risorsa[]
): Record<string, number> {
  const delta: Record<string, number> = {};

  ordiniMercato.forEach((ordine) => {
    const creditiId = 1;
    const risorsa = risorse.find((r) => r.id === ordine.risorsaId);
    const nomeRisorsa = risorsa?.nome ?? "";
    const nomeCrediti = risorse.find((r) => r.id === creditiId)?.nome ?? "Crediti";
    if (ordine.tipo === "compra") {
      const costo = ordine.quantità * ordine.prezzoUnitario;
      delta[nomeRisorsa] = (delta[nomeRisorsa] ?? 0) + ordine.quantità;
      delta[nomeCrediti] = (delta[nomeCrediti] ?? 0) - costo;
    } else {
      const ricavo = ordine.quantità * ordine.prezzoUnitario;
      delta[nomeRisorsa] = (delta[nomeRisorsa] ?? 0) - ordine.quantità;
      delta[nomeCrediti] = (delta[nomeCrediti] ?? 0) + ricavo;
    }
  });

  return delta;
}

