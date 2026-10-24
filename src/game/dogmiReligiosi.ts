/**
 * Dogmi modulari per religioni create dal giocatore.
 * I dogmi naturalisti esistenti restano in dottrinaNaturalista e sono compatibili
 * con i salvataggi precedenti. Gli altri dogmi sono discriminati per tipo,
 * così le future meccaniche possono reagire solo al dogma pertinente.
 */
import type { Abitante } from "../types";
import type { VestitiPersonaggio } from "./personaggioAspetto";
import { OGGETTI_INVENTARIO } from "./inventario";

export type DogmaReligioso =
  | { tipo: "alimento_vietato"; itemId: string }
  | { tipo: "abito_obbligatorio"; destinatari: "fedeli" | "sacerdoti"; vestiti: VestitiPersonaggio }
  | { tipo: "sovrano_rappresentante_divino" };

export const VESTITI_DOGMA: readonly VestitiPersonaggio[] = [
  "viandante", "nobile", "ranger", "mago"
];

export function normalizzaDogmiReligiosi(raw: unknown): DogmaReligioso[] {
  if (!Array.isArray(raw)) return [];
  const result: DogmaReligioso[] = [];
  const ids = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const d = item as Record<string, unknown>;
    let dogma: DogmaReligioso | null = null;
    if (d.tipo === "alimento_vietato" &&
      typeof d.itemId === "string" &&
      OGGETTI_INVENTARIO[d.itemId]?.categoria === "Cibo") {
      dogma = { tipo: "alimento_vietato", itemId: d.itemId };
    } else if (d.tipo === "abito_obbligatorio" &&
      (d.destinatari === "fedeli" || d.destinatari === "sacerdoti") &&
      VESTITI_DOGMA.includes(d.vestiti as VestitiPersonaggio)) {
      dogma = {
        tipo: "abito_obbligatorio",
        destinatari: d.destinatari,
        vestiti: d.vestiti as VestitiPersonaggio
      };
    } else if (d.tipo === "sovrano_rappresentante_divino") {
      dogma = { tipo: "sovrano_rappresentante_divino" };
    }
    if (!dogma) continue;
    const key = dogma.tipo === "alimento_vietato"
      ? dogma.tipo + ":" + dogma.itemId
      : dogma.tipo === "abito_obbligatorio"
        ? dogma.tipo + ":" + dogma.destinatari : dogma.tipo;
    if (ids.has(key)) continue;
    ids.add(key);
    result.push(dogma);
  }
  return result.slice(0, 32);
}

export function vietatoCiboDaDogma(dogmi: readonly DogmaReligioso[], itemId: string): boolean {
  return dogmi.some(d => d.tipo === "alimento_vietato" && d.itemId === itemId);
}

export function abitoPrescrittoDaDogma(
  dogmi: readonly DogmaReligioso[], destinatari: "fedeli" | "sacerdoti"
): VestitiPersonaggio | null {
  const obbligo = dogmi.find((d): d is Extract<DogmaReligioso, { tipo: "abito_obbligatorio" }> =>
    d.tipo === "abito_obbligatorio" && d.destinatari === destinatari);
  return obbligo?.vestiti ?? null;
}

export function rispettaDogmaAbito(
  abitante: Pick<Abitante, "aspetto">,
  dogmi: readonly DogmaReligioso[],
  destinatari: "fedeli" | "sacerdoti"
): boolean {
  const prescritto = abitoPrescrittoDaDogma(dogmi, destinatari);
  if (!prescritto) return true;
  return abitante.aspetto?.vestiti === prescritto;
}

export function pretendeSovranoDivino(dogmi: readonly DogmaReligioso[]): boolean {
  return dogmi.some(d => d.tipo === "sovrano_rappresentante_divino");
}
