import type { EventoDef } from "./eventoTypes";
import { trovaCapoReligiosoSenzaLuogo } from "../luogoCulto";

export const eventoRichiestaLuogoCulto: EventoDef = {
  id: "richiesta-luogo-culto",
  nome: "Richiesta Luogo di Culto",
  emoji: "⛪",
  descrizione:
    "Si attiva appena c'è un Capo Religioso senza Luogo di Culto della sua fede. Accetta, Rifiuta o «Devo pensarci» (in Richieste sulla mappa).",
  durataMesi: 0,
  probabilità: 1,
  condizione: (abitanti, _r, edifici) => trovaCapoReligiosoSenzaLuogo(abitanti, edifici) != null,
  applicaAttivazione: () => {},
  applicaMensile: () => {}
};
