import type { Risorsa } from "../types";

/** Risorse materiali e arcane del regno (la valuta è il Tesoro = moneteGiocatore). */
export const risorseData: Risorsa[] = [
  { id: 2, nome: "Cibo", quantità: 430, unità: "razioni" },
  { id: 3, nome: "Metalli", quantità: 780, unità: "tonnellate" },
  { id: 4, nome: "Energia Magica", quantità: 68, unità: "mana" },
  { id: 5, nome: "Acqua potabile", quantità: 420, unità: "m³" },
  { id: 6, nome: "Materiale Edile", quantità: 320, unità: "tonnellate" },
  { id: 7, nome: "Medicine", quantità: 180, unità: "scorte" },
  { id: 8, nome: "Combustibile", quantità: 95, unità: "tonnellate" },
  { id: 9, nome: "Rifiuti", quantità: 40, unità: "tonnellate" }
];

/** Normalizza risorse legacy: fonde «Crediti» nel Tesoro e migra «Energia» in «Energia Magica». */
export function estraiCreditiLegacyDaRisorse(risorse: Risorsa[]): {
  risorse: Risorsa[];
  creditiLegacy: number;
} {
  let creditiLegacy = 0;
  const next: Risorsa[] = [];
  for (const r of risorse) {
    if (r.nome === "Crediti") {
      creditiLegacy += Math.max(0, Math.floor(r.quantità));
      continue;
    }
    if (r.nome === "Energia") {
      next.push({ ...r, nome: "Energia Magica", unità: "mana" });
      continue;
    }
    if (r.nome === "Energia Magica" && r.unità !== "mana") {
      next.push({ ...r, unità: "mana" });
      continue;
    }
    next.push(r);
  }
  return { risorse: next, creditiLegacy };
}
