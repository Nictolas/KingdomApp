import type { EventoDef } from "./eventoTypes";

export const eventoAssimilazione: EventoDef = {
  id: "assimilazione",
  nome: "Assimilazione",
  emoji: "🤝",
  descrizione:
    "Alcuni nativi (da 0 a 3) vogliono aggiungersi alla colonia. Vuoi accettarli? (Si verifica solo se la Felicità Media degli abitanti è superiore all'80%.)",
  durataMesi: 1,
  probabilità: 0.4,
  condizione: (abitanti) => {
    if (abitanti.length === 0) return false;
    const felicitàMedia = abitanti.reduce((s, a) => s + a.felicità, 0) / abitanti.length;
    return felicitàMedia > 80;
  },
  applicaAttivazione: () => {},
  applicaMensile: () => {}
};
