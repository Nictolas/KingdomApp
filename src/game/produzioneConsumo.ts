import type { Abitante, Edificio, Risorsa } from "../types";
import { getConsumoCibo, getConsumoAcqua } from "./ciboConsumo";
import { calcolaProduzioneSerraMensile } from "./produzioneSerra";
import { getProduttivitaEffettiva } from "./bisogni";

export type CalcolaProduzioneConsumoInput = {
  abitanti: Abitante[];
  edifici: Edificio[];
  risorse: Risorsa[];
  assegnoPensionati: number;
};

/** Calcola produzione/consumo mensile per ogni risorsa a partire dallo stato corrente del regno. */
export function calcolaProduzioneConsumoPuro({
  abitanti,
  edifici,
  risorse,
  assegnoPensionati
}: CalcolaProduzioneConsumoInput): Record<string, number> {
  const variazioni: Record<string, number> = {};

  // Inizializza tutte le risorse a 0
  risorse.forEach((r) => {
    variazioni[r.nome] = 0;
  });

  // Calcola produzione dagli edifici
  edifici.forEach((edificio) => {
    if (edificio.stato === "Operativo" && edificio.produzione) {
      const produzioni = edificio.produzione.split(",").map((p) => p.trim());
      produzioni.forEach((prod) => {
        const numAbitanti = edificio.abitantiAssegnati.length;
        if (numAbitanti > 0) {
          // Trova la risorsa corrispondente
          risorse.forEach((r) => {
            if (prod === r.nome || r.nome.includes(prod) || prod.includes(r.nome)) {
              if (r.nome.toLowerCase().includes("cibo")) {
                if (edificio.nome === "Serra") return;
              } else {
                // Altre risorse: produzione basata sulla produttività media (logica originale)
                const produttivitàMedia =
                  edificio.abitantiAssegnati.reduce((sum, id) => {
                    const abitante = abitanti.find((a) => a.id === id);
                    return sum + (abitante ? getProduttivitaEffettiva(abitante) : 0);
                  }, 0) / numAbitanti;

                const produzione = Math.floor(numAbitanti * (produttivitàMedia / 10));
                variazioni[r.nome] = (variazioni[r.nome] || 0) + produzione;
              }
            }
          });
        }
      });
    }
  });

  variazioni["__ciboInventarioSerra"] = calcolaProduzioneSerraMensile(edifici);

  // Bonus +10% Cibo se il ministro dell'Agricoltura ha personalità "Pollice Verde"
  const totaleCiboProdotto = variazioni["__ciboProdotto"];
  if (totaleCiboProdotto != null && totaleCiboProdotto > 0) {
    const ministroAgricoltura = abitanti.find((a) => a.ministero === "Ministero dell'Agricoltura");
    if (ministroAgricoltura?.personalità === "Pollice Verde") {
      risorse.forEach((r) => {
        if (r.nome.toLowerCase().includes("cibo")) {
          variazioni[r.nome] = (variazioni[r.nome] || 0) + Math.floor(totaleCiboProdotto * 0.1);
        }
      });
    }
    delete variazioni["__ciboProdotto"];
  }

  // Calcola consumo del cibo basato sulla salute degli abitanti (4 categorie peso)
  abitanti.forEach((abitante) => {
    const consumoCibo = getConsumoCibo(abitante);

    // Trova la risorsa "Cibo"
    risorse.forEach((r) => {
      if (r.nome.toLowerCase().includes("cibo")) {
        variazioni[r.nome] = (variazioni[r.nome] || 0) - consumoCibo;
      }
    });
  });

  // Consumo acqua potabile: ogni abitante (esclusi i Robot) consuma 2-5 m³/mese
  abitanti.forEach((abitante) => {
    if (abitante.razza === "Robot") return;
    const consumoAcqua = getConsumoAcqua(abitante);
    risorse.forEach((r) => {
      if (r.nome.toLowerCase().includes("acqua")) {
        variazioni[r.nome] = (variazioni[r.nome] || 0) - consumoAcqua;
      }
    });
  });

  // Calcola consumo degli edifici
  edifici.forEach((edificio) => {
    if (edificio.stato === "Operativo" && edificio.consumo) {
      const consumi = edificio.consumo.split(",").map((c) => c.trim());
      consumi.forEach((cons) => {
        const consumoBase = edificio.efficienza / 20;
        const consumo = Math.floor(consumoBase * (edificio.occupazione / edificio.capacità));

        risorse.forEach((r) => {
          if (cons === r.nome || r.nome.includes(cons) || cons.includes(r.nome)) {
            variazioni[r.nome] = (variazioni[r.nome] || 0) - consumo;
          }
        });
      });
    }
  });

  // Fazione Robots: 2 energia per ogni membro Robot
  const numRobots = abitanti.filter((a) => a.razza === "Robot").length;
  if (numRobots > 0) {
    risorse.forEach((r) => {
      if (r.nome === "Energia") {
        variazioni[r.nome] = (variazioni[r.nome] || 0) - numRobots * 2;
      }
    });
  }

  // Calcola variazioni Crediti colonia (macro). Gli stipendi pubblici escono da moneteGiocatore, non da qui.
  const totaleRedditi = abitanti
    .filter((a) => a.lavoro !== "Pensionato")
    .reduce((sum, a) => sum + a.reddito, 0);
  const totaleSpese = abitanti.reduce((sum, a) => sum + a.spese, 0);
  const numPensionati = abitanti.filter((a) => a.lavoro === "Pensionato").length;
  const costoPensioni = numPensionati * assegnoPensionati;

  risorse.forEach((r) => {
    if (r.nome === "Crediti") {
      variazioni[r.nome] = totaleRedditi - totaleSpese - costoPensioni;
    }
  });

  return variazioni;
}

