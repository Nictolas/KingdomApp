import type { Abitante, Risorsa, Edificio, OrdineMercato, EventoInCorso } from "../types";
import { EVENTI_CATALOGO } from "./eventi";
import { getConsumoCibo, getProduzioneCiboPerAbitante } from "./ciboConsumo";

export type AvanzaMeseInput = {
  abitanti: Abitante[];
  edifici: Edificio[];
  risorse: Risorsa[];
  ordiniMercato: OrdineMercato[];
  eventiInCorso: EventoInCorso[];
  mese: number;
  anno: number;
  divietoEspatrioAttivo: boolean;
  punteggioSanzioni: number;
  calcolaFelicitàModificata: (a: Abitante) => number;
};

export type AvanzaMeseOutput = {
  abitanti: Abitante[];
  edifici: Edificio[];
  risorse: Risorsa[];
  eventiInCorso: EventoInCorso[];
  nuovoMese: number;
  nuovoAnno: number;
  deltaNativiNonIntegrati: number;
  pendingAssimilazione: number | null;
};

/**
 * Logica pura di avanzamento mese: dato lo stato attuale e la config, restituisce il nuovo stato.
 * Nessun side-effect; il hook applicherà gli aggiornamenti e pulirà gli ordini mercato.
 */
export function runAvanzaMese(input: AvanzaMeseInput): AvanzaMeseOutput {
  const {
    abitanti,
    edifici,
    risorse,
    ordiniMercato,
    eventiInCorso,
    mese,
    anno,
    divietoEspatrioAttivo,
    punteggioSanzioni,
    calcolaFelicitàModificata
  } = input;

  // Emigrazione: felicità <= 10 e crediti >= 100 → 50% probabilità di andarsene (se divieto non attivo)
  let abitantiRimasti = abitanti;
  if (!divietoEspatrioAttivo) {
    abitantiRimasti = abitanti.filter((abitante) => {
      const felicitàModificata = calcolaFelicitàModificata(abitante);
      const puòEmigrare = felicitàModificata <= 10 && abitante.crediti >= 100;
      if (puòEmigrare) return Math.random() >= 0.5;
      return true;
    });
  }

  // Aggiorna abitanti (schiavi vs non-schiavi, crediti, stanchezza, peso, salute, reddito disoccupati)
  const nuoviAbitanti = abitantiRimasti.map((abitante) => {
    const èSchiavo = abitante.fazioni?.includes("Schiavi") ?? false;
    if (èSchiavo) {
      const nuovaStanchezza = Math.min(100, abitante.stanchezza + Math.floor(Math.random() * 10));
      const variazionePeso = Math.floor(Math.random() * 6) - 2;
      const nuovoPeso = Math.max(0, Math.min(100, abitante.peso + variazionePeso));
      const variazioneSalute = Math.floor(Math.random() * 6) - 2;
      const nuovaSalute = Math.max(0, Math.min(100, abitante.salute + variazioneSalute));
      return {
        ...abitante,
        crediti: 0,
        reddito: 0,
        spese: 0,
        stanchezza: nuovaStanchezza,
        peso: nuovoPeso,
        salute: nuovaSalute
      };
    }
    const redditoEffettivo = abitante.lavoro === "Disoccupato" ? 0 : abitante.reddito;
    const nuovoSaldo = abitante.crediti + redditoEffettivo - abitante.spese;
    const nuovaStanchezza = Math.min(100, abitante.stanchezza + Math.floor(Math.random() * 10));
    const variazionePeso = Math.floor(Math.random() * 6) - 2;
    const nuovoPeso = Math.max(0, Math.min(100, abitante.peso + variazionePeso));
    const variazioneSalute = Math.floor(Math.random() * 6) - 2;
    const nuovaSalute = Math.max(0, Math.min(100, abitante.salute + variazioneSalute));
    return {
      ...abitante,
      reddito: abitante.lavoro === "Disoccupato" ? 0 : abitante.reddito,
      crediti: Math.max(0, nuovoSaldo),
      stanchezza: nuovaStanchezza,
      peso: nuovoPeso,
      salute: nuovaSalute
    };
  });

  // Aggiorna edifici (variazione efficienza se operativo)
  const nuoviEdifici = edifici.map((edificio) => {
    if (edificio.stato === "Operativo") {
      const variazioneEfficienza = Math.floor(Math.random() * 6) - 2;
      const nuovaEfficienza = Math.max(50, Math.min(100, edificio.efficienza + variazioneEfficienza));
      return { ...edificio, efficienza: nuovaEfficienza };
    }
    return edificio;
  });

  // Aggiorna risorse (crediti, produzione/consumo edifici, consumo cibo, bonus ministro agricoltura)
  const nuoveRisorse = risorse.map((risorsa) => {
    let nuovaQuantità = risorsa.quantità;
    let totaleCiboProdotto = 0;

    if (risorsa.nome === "Crediti") {
      const totaleRedditi = nuoviAbitanti.reduce((sum, a) => sum + a.reddito, 0);
      const totaleSpese = nuoviAbitanti.reduce((sum, a) => sum + a.spese, 0);
      const totaleManutenzione = nuoviEdifici
        .filter((e) => e.stato === "Operativo")
        .reduce((sum, e) => sum + e.manutenzione, 0);
      nuovaQuantità = risorsa.quantità + totaleRedditi - totaleSpese - totaleManutenzione;
    }

    nuoviEdifici.forEach((edificio) => {
      if (edificio.stato !== "Operativo") return;
      if (edificio.produzione) {
        const produzioni = edificio.produzione.split(",").map((p) => p.trim());
        produzioni.forEach((prod) => {
          if (prod === risorsa.nome || risorsa.nome.includes(prod) || prod.includes(risorsa.nome)) {
            const numAbitanti = edificio.abitantiAssegnati.length;
            if (numAbitanti > 0) {
              if (risorsa.nome.toLowerCase().includes("cibo")) {
                const produzioneTotale = edificio.abitantiAssegnati.reduce(
                  (sum, id) => sum + getProduzioneCiboPerAbitante(id),
                  0
                );
                totaleCiboProdotto += produzioneTotale;
                nuovaQuantità += produzioneTotale;
              } else {
                const produttivitàMedia =
                  edificio.abitantiAssegnati.reduce((sum, id) => {
                    const abitante = nuoviAbitanti.find((a) => a.id === id);
                    return sum + (abitante?.produttività || 0);
                  }, 0) / numAbitanti;
                nuovaQuantità += Math.floor(numAbitanti * (produttivitàMedia / 10));
              }
            }
          }
        });
      }
      if (edificio.consumo) {
        const consumi = edificio.consumo.split(",").map((c) => c.trim());
        consumi.forEach((cons) => {
          if (cons === risorsa.nome || risorsa.nome.includes(cons) || cons.includes(risorsa.nome)) {
            const consumoBase = edificio.efficienza / 20;
            nuovaQuantità -= Math.floor(consumoBase * (edificio.occupazione / edificio.capacità));
          }
        });
      }
    });

    if (risorsa.nome.toLowerCase().includes("cibo") && totaleCiboProdotto > 0) {
      const ministroAgricoltura = nuoviAbitanti.find((a) => a.ministero === "Ministero dell'Agricoltura");
      if (ministroAgricoltura?.personalità === "Pollice Verde") {
        nuovaQuantità += Math.floor(totaleCiboProdotto * 0.1);
      }
    }

    if (risorsa.nome.toLowerCase().includes("cibo")) {
      nuoviAbitanti.forEach((abitante) => {
        nuovaQuantità -= getConsumoCibo(abitante);
      });
    }

    return { ...risorsa, quantità: Math.max(0, nuovaQuantità) };
  });

  const deltaNativiNonIntegrati = Math.floor(Math.random() * 6);

  const nuovoMese = mese === 12 ? 1 : mese + 1;
  const nuovoAnno = mese === 12 ? anno + 1 : anno;
  const risorseEv = nuoveRisorse.map((r) => ({ ...r }));
  const abitantiEv = nuoviAbitanti.map((a) => ({ ...a }));
  const edificiEv = nuoviEdifici.map((e) => ({ ...e }));

  const mesiTrascorsi = (ev: EventoInCorso) =>
    (nuovoAnno - ev.iniziatoAnno) * 12 + (nuovoMese - ev.iniziatoMese);
  let nuoviEventiInCorso = eventiInCorso.filter((ev) => mesiTrascorsi(ev) < ev.durataMesi);
  const avevaAssimilazione = nuoviEventiInCorso.some((e) => e.id === "assimilazione");

  nuoviEventiInCorso.forEach((ev) => {
    const def = EVENTI_CATALOGO.find((d) => d.id === ev.id);
    if (def) def.applicaMensile(risorseEv, abitantiEv, edificiEv);
  });

  EVENTI_CATALOGO.forEach((def) => {
    if (nuoviEventiInCorso.some((e) => e.id === def.id)) return;
    if (!def.condizione(abitantiEv, risorseEv, edificiEv, punteggioSanzioni)) return;
    if (Math.random() >= def.probabilità) return;
    nuoviEventiInCorso = [
      ...nuoviEventiInCorso,
      { id: def.id, iniziatoMese: nuovoMese, iniziatoAnno: nuovoAnno, durataMesi: def.durataMesi }
    ];
    def.applicaAttivazione(risorseEv, abitantiEv, edificiEv);
  });

  const assimilazioneAppenaAggiunto =
    nuoviEventiInCorso.some((e) => e.id === "assimilazione") && !avevaAssimilazione;
  const pendingAssimilazione = assimilazioneAppenaAggiunto ? 1 + Math.floor(Math.random() * 3) : null;

  // Applica ordini mercato (acquisti/vendite)
  let risorseDopoOrdini = risorseEv.map((r) => ({ ...r }));
  const creditiId = 1;
  ordiniMercato.forEach((ordine) => {
    if (ordine.risorsaId === creditiId || ordine.quantità <= 0 || ordine.prezzoUnitario <= 0) return;
    const costo = ordine.quantità * ordine.prezzoUnitario;
    const crediti = risorseDopoOrdini.find((r) => r.id === creditiId);
    const risorsa = risorseDopoOrdini.find((r) => r.id === ordine.risorsaId);
    if (!crediti || !risorsa) return;
    if (ordine.tipo === "compra") {
      if (crediti.quantità < costo) return;
      risorseDopoOrdini = risorseDopoOrdini.map((r) => {
        if (r.id === creditiId) return { ...r, quantità: r.quantità - costo };
        if (r.id === ordine.risorsaId) return { ...r, quantità: r.quantità + ordine.quantità };
        return r;
      });
    } else {
      if (risorsa.quantità < ordine.quantità) return;
      const ricavo = ordine.quantità * ordine.prezzoUnitario;
      risorseDopoOrdini = risorseDopoOrdini.map((r) => {
        if (r.id === creditiId) return { ...r, quantità: r.quantità + ricavo };
        if (r.id === ordine.risorsaId) return { ...r, quantità: r.quantità - ordine.quantità };
        return r;
      });
    }
  });

  return {
    abitanti: abitantiEv,
    edifici: edificiEv,
    risorse: risorseDopoOrdini,
    eventiInCorso: nuoviEventiInCorso,
    nuovoMese,
    nuovoAnno,
    deltaNativiNonIntegrati,
    pendingAssimilazione
  };
}
