import type { Abitante } from "../../types";
import type { EventoDef } from "./eventoTypes";

export const eventoEmigrazione: EventoDef = {
  id: "emigrazione",
  nome: "Emigrazione",
  emoji: "✈️",
  descrizione:
    "Un abitante con Felicità pari o inferiore al 50% lascia il regno per cercare fortuna altrove.",
  durataMesi: 1,
  probabilità: 1,
  condizione: (abitanti, _r, _e, _p, divietoEspatrioAttivo, calcolaFelicitàModificata) => {
    if (divietoEspatrioAttivo) return false;
    const felicità = (a: Abitante) =>
      calcolaFelicitàModificata ? calcolaFelicitàModificata(a) : 50 + (a.modificatoriSoddisfazione ?? []).reduce((s,m) => s + m.delta,0) * 10;
    return abitanti.some((a) => a.id !== 1 && a.razza !== "Golem" && felicità(a) <= 50);
  },
  applicaAttivazione: (_risorse, abitanti, edifici, ctx) => {
    const felicità = (a: Abitante) =>
      ctx?.calcolaFelicitàModificata ? ctx.calcolaFelicitàModificata(a) : 50 + (a.modificatoriSoddisfazione ?? []).reduce((s,m) => s + m.delta,0) * 10;
    const candidati = abitanti.filter((a) => a.id !== 1 && a.razza !== "Golem" && felicità(a) <= 50);
    if (candidati.length === 0) return;
    const idsEmigrati = new Set(candidati.map((c) => c.id));
    const nomi = candidati.map((c) => c.nome);
    // Rimuovi tutti i candidati dall'array (in ordine inverso per non sbagliare gli indici)
    candidati.forEach((c) => {
      const idx = abitanti.findIndex((a) => a.id === c.id);
      if (idx >= 0) abitanti.splice(idx, 1);
    });
    abitanti.forEach((a) => {
      if (a.amici?.length) a.amici = a.amici.filter((r) => !idsEmigrati.has(r.id));
      if (a.rivali?.length) a.rivali = a.rivali.filter((r) => !idsEmigrati.has(r.id));
    });
    edifici.forEach((e) => {
      if (e.abitantiAssegnati) {
        e.abitantiAssegnati = e.abitantiAssegnati.filter((id) => !idsEmigrati.has(id));
      }
    });
    const messaggio =
      nomi.length === 1
        ? `${nomi[0]} ha lasciato il regno.`
        : nomi.length === 2
          ? `${nomi[0]} e ${nomi[1]} hanno lasciato il regno.`
          : `${nomi.slice(0, -1).join(", ")} e ${nomi[nomi.length - 1]} hanno lasciato il regno.`;
    return { messaggioExtra: messaggio };
  },
  applicaMensile: () => {}
};
