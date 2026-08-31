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

export const COLORI_VESTITI: Record<VestitiPersonaggio, { body: string; accent: string }> = {
  viandante: { body: "#8b5a2b", accent: "#d6b56f" },
  nobile: { body: "#7c2d3b", accent: "#e4b84c" },
  ranger: { body: "#315c3b", accent: "#9bb36a" },
  mago: { body: "#44306f", accent: "#9f8bd8" }
};
