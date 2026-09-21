import type { Risorsa } from "../types";

type RisorsaConNome = Pick<Risorsa, "nome">;

export function getResourceEmoji(r: RisorsaConNome): string {
  const n = r.nome.toLowerCase();
  if (n.includes("cibo")) return "🍱";
  if (n.includes("energia magica")) return "✨";
  if (n.includes("acqua")) return "💧";
  if (n.includes("materiale edile")) return "🧱";
  if (n.includes("medicine")) return "💊";
  if (n.includes("combustibile")) return "⛽";
  if (n.includes("rifiuti")) return "🗑️";
  return "⛏️";
}

export function getResourceRoute(r: RisorsaConNome): string | null {
  const n = r.nome.toLowerCase();
  if (n.includes("cibo")) return "/cibo";
  if (n.includes("acqua")) return "/acqua";
  if (n.includes("rifiuti")) return "/rifiuti";
  return null;
}
