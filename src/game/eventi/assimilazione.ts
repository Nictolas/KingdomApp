import type { EventoDef } from "./eventoTypes";

export const eventoAssimilazione: EventoDef = {
  id: "assimilazione",
  nome: "Assimilazione",
  emoji: "🤝",
  descrizione:
    "Alcuni nativi (da 0 a 3) vogliono aggiungersi al regno. Vuoi accettarli? (Si verifica solo se la Felicità Media degli abitanti è superiore all'80%.)",
  durataMesi: 1,
  probabilità: 0.4,
  condizione: (abitanti) => {
    const conFelicità = abitanti.filter((a) => a.razza !== "Golem");
    if (conFelicità.length === 0) return false;
    const felicitàMedia = conFelicità.reduce((s, a) => s + a.felicità, 0) / conFelicità.length;
    return felicitàMedia > 80;
  },
  applicaAttivazione: () => {},
  applicaMensile: () => {}
};
