import type { EventoDef } from "./eventoTypes";
import { trovaCapoReligiosoSenzaLuogo } from "../luogoCulto";

export const eventoRichiestaLuogoCulto: EventoDef = {
  id: "richiesta-luogo-culto",
  nome: "Richiesta Luogo di Culto",
  emoji: "⛪",
  descrizione:
    "Un Capo Religioso chiede al giocatore di costruire un Luogo di Culto per la sua fede, se non ne esiste ancora uno sulla mappa.",
  durataMesi: 1,
  probabilità: 0.6,
  condizione: (abitanti, _r, edifici, _p, _d, _f, _s, haPendingRichiestaLuogoCulto) => {
    if (haPendingRichiestaLuogoCulto) return false;
    return trovaCapoReligiosoSenzaLuogo(abitanti, edifici) != null;
  },
  applicaAttivazione: () => {},
  applicaMensile: () => {}
};
