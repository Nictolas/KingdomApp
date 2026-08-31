export type RazzaGiocatore = "Umano" | "Elfo" | "Nano" | "Orco";
export type StileCapelli = "corti" | "spettinati" | "lunghi" | "trecce";
export type StileOcchi = "tondi" | "determinati" | "allegri";
export type VestitiPersonaggio = "viandante" | "nobile" | "ranger" | "mago";
export type CappelloPersonaggio = "nessuno" | "cappuccio" | "berretto" | "corona";

export type AspettoPersonaggio = {
  coloreCapelli: string;
  stileCapelli: StileCapelli;
  stileOcchi: StileOcchi;
  colorePelle: string;
  vestiti: VestitiPersonaggio;
  cappello: CappelloPersonaggio;
};

export const ASPETTO_GIOCATORE_DEFAULT: AspettoPersonaggio = {
  coloreCapelli: "#6b3f24",
  stileCapelli: "spettinati",
  stileOcchi: "tondi",
  colorePelle: "#e9b38f",
  vestiti: "viandante",
  cappello: "nessuno"
};

export const COLORI_CAPELLI = ["#24170f", "#6b3f24", "#b06a32", "#dfbd65", "#b9bec8"];
export const COLORI_PELLE = ["#f2cfb0", "#e9b38f", "#bd795d", "#87513d", "#5a382c", "#79a86b"];

export const STILI_CAPELLI: StileCapelli[] = ["corti", "spettinati", "lunghi", "trecce"];
export const STILI_OCCHI: StileOcchi[] = ["tondi", "determinati", "allegri"];
export const VESTITI_PERSONAGGIO: VestitiPersonaggio[] = ["viandante", "nobile", "ranger", "mago"];
export const CAPPELLI_PERSONAGGIO: CappelloPersonaggio[] = ["nessuno", "nessuno", "cappuccio", "berretto", "corona"];

export const COLORI_VESTITI: Record<VestitiPersonaggio, { body: string; accent: string }> = {
  viandante: { body: "#8b5a2b", accent: "#d6b56f" },
  nobile: { body: "#7c2d3b", accent: "#e4b84c" },
  ranger: { body: "#315c3b", accent: "#9bb36a" },
  mago: { body: "#44306f", accent: "#9f8bd8" }
};

type RazzaConAspetto = RazzaGiocatore | "Goblin";

const pick = <T>(values: readonly T[], random: () => number): T =>
  values[Math.min(values.length - 1, Math.floor(random() * values.length))]!;

/** Crea un'identità visiva completa usando esattamente gli stessi pezzi disponibili nell'editor. */
export function generaAspettoCasuale(
  razza: RazzaConAspetto = "Umano",
  random: () => number = Math.random
): AspettoPersonaggio {
  const coloriPelle = razza === "Orco" || razza === "Goblin"
    ? ["#79a86b", "#668f58", "#8aa66b"]
    : COLORI_PELLE.filter((color) => color !== "#79a86b");
  const cappelli = razza === "Nano"
    ? ["nessuno", "berretto", "cappuccio"] as const
    : CAPPELLI_PERSONAGGIO;

  return {
    coloreCapelli: pick(COLORI_CAPELLI, random),
    stileCapelli: pick(STILI_CAPELLI, random),
    stileOcchi: pick(STILI_OCCHI, random),
    colorePelle: pick(coloriPelle, random),
    vestiti: pick(VESTITI_PERSONAGGIO, random),
    cappello: pick(cappelli, random)
  };
}

/** Variante stabile per completare vecchi salvataggi senza cambiare volto a ogni caricamento. */
export function generaAspettoDaSeed(razza: RazzaConAspetto, seed: number): AspettoPersonaggio {
  let state = (seed >>> 0) || 1;
  return generaAspettoCasuale(razza, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  });
}
