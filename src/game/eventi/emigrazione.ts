import type { Abitante } from "../../types";
import type { EventoDef } from "./eventoTypes";

export const eventoEmigrazione: EventoDef = {
  id: "emigrazione",
  nome: "Emigrazione",
  emoji: "✈️",
  descrizione:
    "Un abitante con Felicità pari o inferiore al 50% lascia la colonia per cercare fortuna altrove.",
  durataMesi: 1,
  probabilità: 1,
  condizione: (abitanti, _r, _e, _p, divietoEspatrioAttivo, calcolaFelicitàModificata) => {
    if (divietoEspatrioAttivo) return false;
    const felicità = (a: Abitante) =>
      calcolaFelicitàModificata ? calcolaFelicitàModificata(a) : a.felicità;
    return abitanti.some((a) => a.id !== 1 && felicità(a) <= 50);
  },
  applicaAttivazione: (_risorse, abitanti, edifici, ctx) => {
    const felicità = (a: Abitante) =>
      ctx?.calcolaFelicitàModificata ? ctx.calcolaFelicitàModificata(a) : a.felicità;
    const candidati = abitanti.filter((a) => a.id !== 1 && felicità(a) <= 50);
    if (candidati.length === 0) return;
    const scelto = candidati[Math.floor(Math.random() * candidati.length)];
    const nome = scelto.nome;
    const idx = abitanti.findIndex((a) => a.id === scelto.id);
    if (idx >= 0) abitanti.splice(idx, 1);
    const idEmigrato = scelto.id;
    abitanti.forEach((a) => {
      if (a.amici?.length) a.amici = a.amici.filter((r) => r.id !== idEmigrato);
      if (a.rivali?.length) a.rivali = a.rivali.filter((r) => r.id !== idEmigrato);
    });
    edifici.forEach((e) => {
      if (e.abitantiAssegnati) {
        e.abitantiAssegnati = e.abitantiAssegnati.filter((id) => id !== idEmigrato);
      }
    });
    return { messaggioExtra: `${nome} ha lasciato la colonia.` };
  },
  applicaMensile: () => {}
};
