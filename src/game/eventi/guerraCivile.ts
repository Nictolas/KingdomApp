import type { Abitante, Edificio } from "../../types";
import type { EventoDef } from "./eventoTypes";
import { modificaTesoro } from "./eventoTypes";

const CASERMA_MIN_BLOCCO = 3;
const SOGLIA_SODDISFAZIONE_SICUREZZA_BLOCCO = 70;
const CASERMA_MIN_MITIGAZIONE = 3;

/** Rimuove gli abitanti con id in idsToRemove da abitanti e da tutti gli edifici. */
function rimuoviVittime(abitanti: Abitante[], edifici: Edificio[], idsToRemove: Set<number>): void {
  for (let i = abitanti.length - 1; i >= 0; i--) {
    if (idsToRemove.has(abitanti[i]!.id)) abitanti.splice(i, 1);
  }
  edifici.forEach((e) => {
    const nuovi = (e.abitantiAssegnati ?? []).filter((id) => !idsToRemove.has(id));
    if (nuovi.length !== (e.abitantiAssegnati?.length ?? 0)) {
      (e as Edificio).abitantiAssegnati = nuovi;
      (e as Edificio).occupazione = nuovi.length;
    }
  });
}

/** Scatta quando i Lealisti sono 50%+1. Bloccato se Caserma ha almeno 3 addetti e Soddisfazione Sicurezza >= 70. */
export const eventoGuerraCivile: EventoDef = {
  id: "guerra-civile",
  nome: "Guerra Civile",
  emoji: "⚔️",
  descrizione:
    "I Lealisti sono diventati la maggioranza (50%+1) della colonia. Scoppia un conflitto interno tra lealisti e rivoluzionari. La Caserma (3+ addetti) e la Soddisfazione Sicurezza bloccano l'evento o ne mitigano gli effetti.",
  durataMesi: 3,
  probabilità: 0.5,
  condizione: (abitanti, _risorse, edifici, _p, _d, _c, soddisfazioneFazioni) => {
    const totale = abitanti.length;
    if (totale < 2) return false;
    const lealisti = abitanti.filter((a) => a.fazioni?.includes("Lealisti")).length;
    const maggioranza = Math.floor(totale / 2) + 1;
    if (lealisti < maggioranza) return false;
    // Blocco: Caserma con almeno 3 addetti E Soddisfazione Sicurezza >= 70
    const caserma = edifici.find((e) => e.nome === "Caserma");
    const inCaserma = caserma?.abitantiAssegnati?.length ?? 0;
    const soddSicurezza = soddisfazioneFazioni?.["Sicurezza"] ?? 80;
    if (inCaserma >= CASERMA_MIN_BLOCCO && soddSicurezza >= SOGLIA_SODDISFAZIONE_SICUREZZA_BLOCCO) return false;
    return true;
  },
  applicaAttivazione: (_risorse, _a, _e, ctx) => {
    modificaTesoro(ctx, -200);
  },
  applicaMensile: (_r, abitanti, edifici) => {
    const caserma = edifici.find((e) => e.nome === "Caserma");
    const inCaserma = caserma?.abitantiAssegnati?.length ?? 0;
    const mitigazione = inCaserma >= CASERMA_MIN_MITIGAZIONE;

    // Malus: mitigato (-2 felicità, -1 lealtà) o pieno (-4, -3)
    const deltaFelicità = mitigazione ? -2 : -4;
    const deltaLealtà = mitigazione ? -1 : -3;
    abitanti.forEach((a) => {
      if (a.razza === "Robot") return;
      (a as Abitante).felicità = Math.max(1, (a as Abitante).felicità + deltaFelicità);
      (a as Abitante).lealtà = Math.max(0, (a as Abitante).lealtà + deltaLealtà);
    });

    // Vittime: pool Lealisti e Sicurezza (escluso Comandante id 1)
    const poolLealisti = abitanti.filter((a) => a.id !== 1 && a.fazioni?.includes("Lealisti"));
    const poolSicurezza = abitanti.filter((a) => a.id !== 1 && a.fazioni?.includes("Sicurezza"));
    const idsToRemove = new Set<number>();

    if (mitigazione) {
      // Una sola vittima casuale tra Lealisti ∪ Sicurezza
      const poolUnito = [...poolLealisti];
      poolSicurezza.forEach((a) => {
        if (!poolUnito.some((x) => x.id === a.id)) poolUnito.push(a);
      });
      if (poolUnito.length > 0) {
        const vittima = poolUnito[Math.floor(Math.random() * poolUnito.length)]!;
        idsToRemove.add(vittima.id);
      }
    } else {
      // Due vittime: uno Lealista, uno Sicurezza (distinti)
      if (poolLealisti.length > 0) {
        const v1 = poolLealisti[Math.floor(Math.random() * poolLealisti.length)]!;
        idsToRemove.add(v1.id);
      }
      const poolSicurezzaSenzaPrimo = poolSicurezza.filter((a) => !idsToRemove.has(a.id));
      if (poolSicurezzaSenzaPrimo.length > 0) {
        const v2 = poolSicurezzaSenzaPrimo[Math.floor(Math.random() * poolSicurezzaSenzaPrimo.length)]!;
        idsToRemove.add(v2.id);
      }
    }

    if (idsToRemove.size > 0) rimuoviVittime(abitanti, edifici, idsToRemove);
  }
};
