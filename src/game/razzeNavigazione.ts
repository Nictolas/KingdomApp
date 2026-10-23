import type { Abitante, Razza } from "../types";

/** Slug pubblici stabili per le schede razziali. */
export const SCHEDE_RAZZE: readonly {
  razza: Razza;
  slug: string;
  titolo: string;
  emoji: string;
  previewSeed?: number;
}[] = [
  { razza: "Umano", slug: "umani", titolo: "Umani", emoji: "👤", previewSeed: 42 },
  { razza: "Elfo", slug: "elfi", titolo: "Elfi", emoji: "🧝", previewSeed: 84 },
  { razza: "Nano", slug: "nani", titolo: "Nani", emoji: "⛏️", previewSeed: 126 },
  { razza: "Orco", slug: "orchi", titolo: "Orchi", emoji: "👹", previewSeed: 168 },
  { razza: "Goblin", slug: "goblin", titolo: "Goblin", emoji: "👺", previewSeed: 210 },
  { razza: "Felix", slug: "felix", titolo: "Felix", emoji: "🐱", previewSeed: 252 },
  { razza: "Golem", slug: "golem", titolo: "Golem", emoji: "🗿" }
];

export function schedaDaRazza(razza: Razza) {
  return SCHEDE_RAZZE.find((item) => item.razza === razza);
}

export function schedaDaSlug(slug: string) {
  return SCHEDE_RAZZE.find((item) => item.slug === slug);
}

export function abitantiPerRazza(abitanti: readonly Abitante[], razza: Razza): Abitante[] {
  return abitanti.filter((a) => (a.razza ?? "Umano") === razza)
    .sort((a, b) => a.nome.localeCompare(b.nome, "it", { sensitivity: "base" }) || a.id - b.id);
}
