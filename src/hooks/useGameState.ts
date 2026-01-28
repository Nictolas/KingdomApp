import { useState, useCallback } from "react";
import type { Abitante, Risorsa, Edificio } from "../types";
import { abitantiData, risorseData, edificiData } from "../kingdomData";

export function useGameState() {
  const [abitanti, setAbitanti] = useState<Abitante[]>(abitantiData);
  const [risorse, setRisorse] = useState<Risorsa[]>(risorseData);
  const [edifici, setEdifici] = useState<Edificio[]>(edificiData);
  const [mese, setMese] = useState(1);
  const [anno, setAnno] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const avanzaMese = useCallback(async () => {
    setIsLoading(true);

    // Simula un caricamento per rendere l'aggiornamento visibile
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Aggiorna gli abitanti
    const nuoviAbitanti = abitanti.map((abitante) => {
      // Calcola il nuovo saldo (reddito - spese)
      const nuovoSaldo = abitante.crediti + abitante.reddito - abitante.spese;
      
      // Aggiorna la stanchezza (aumenta leggermente, ma non oltre 100)
      const nuovaStanchezza = Math.min(100, abitante.stanchezza + Math.floor(Math.random() * 10));
      
      // Aggiorna la salute (può migliorare o peggiorare leggermente)
      const variazioneSalute = Math.floor(Math.random() * 6) - 2; // -2 a +3
      const nuovaSalute = Math.max(0, Math.min(100, abitante.salute + variazioneSalute));

      return {
        ...abitante,
        crediti: Math.max(0, nuovoSaldo), // Non può andare sotto zero
        stanchezza: nuovaStanchezza,
        salute: nuovaSalute
      };
    });

    // Aggiorna gli edifici (potrebbero migliorare o peggiorare l'efficienza)
    const nuoviEdifici = edifici.map((edificio) => {
      if (edificio.stato === "Operativo") {
        // Piccola variazione casuale dell'efficienza
        const variazioneEfficienza = Math.floor(Math.random() * 6) - 2; // -2 a +3
        const nuovaEfficienza = Math.max(50, Math.min(100, edificio.efficienza + variazioneEfficienza));

        return {
          ...edificio,
          efficienza: nuovaEfficienza
        };
      }
      return edificio;
    });

    // Aggiorna le risorse usando i nuovi valori
    const nuoveRisorse = risorse.map((risorsa) => {
      let nuovaQuantità = risorsa.quantità;

      // Aggiorna i crediti della colonia (somma dei redditi degli abitanti meno le spese)
      if (risorsa.nome === "Crediti") {
        const totaleRedditi = nuoviAbitanti.reduce((sum, a) => sum + a.reddito, 0);
        const totaleSpese = nuoviAbitanti.reduce((sum, a) => sum + a.spese, 0);
        const totaleManutenzione = nuoviEdifici
          .filter((e) => e.stato === "Operativo")
          .reduce((sum, e) => sum + e.manutenzione, 0);
        
        nuovaQuantità = risorsa.quantità + totaleRedditi - totaleSpese - totaleManutenzione;
      }

      // Calcola produzione/consumo basato sugli edifici
      nuoviEdifici.forEach((edificio) => {
        if (edificio.stato === "Operativo") {
          if (edificio.produzione) {
            const produzioni = edificio.produzione.split(",").map((p) => p.trim());
            produzioni.forEach((prod) => {
              if (prod === risorsa.nome || risorsa.nome.includes(prod) || prod.includes(risorsa.nome)) {
                // Produzione basata sul numero di abitanti assegnati
                // Ogni abitante produce una quantità base moltiplicata per la sua produttività media
                const numAbitanti = edificio.abitantiAssegnati.length;
                if (numAbitanti > 0) {
                  const produttivitàMedia = edificio.abitantiAssegnati.reduce((sum, id) => {
                    const abitante = nuoviAbitanti.find((a) => a.id === id);
                    return sum + (abitante?.produttività || 0);
                  }, 0) / numAbitanti;
                  
                  // Produzione = numero abitanti * produttività media / 10
                  const produzione = Math.floor(numAbitanti * (produttivitàMedia / 10));
                  nuovaQuantità += produzione;
                }
              }
            });
          }
          if (edificio.consumo) {
            const consumi = edificio.consumo.split(",").map((c) => c.trim());
            consumi.forEach((cons) => {
              if (cons === risorsa.nome || risorsa.nome.includes(cons) || cons.includes(risorsa.nome)) {
                // Consumo basato sull'efficienza dell'edificio
                const consumoBase = edificio.efficienza / 20;
                nuovaQuantità -= Math.floor(consumoBase * (edificio.occupazione / edificio.capacità));
              }
            });
          }
        }
      });

      // Limiti per alcune risorse
      if (risorsa.nome === "Ossigeno") {
        nuovaQuantità = Math.max(0, Math.min(100, nuovaQuantità));
      }

      return {
        ...risorsa,
        quantità: Math.max(0, nuovaQuantità)
      };
    });

    // Applica tutti gli aggiornamenti
    setAbitanti(nuoviAbitanti);
    setEdifici(nuoviEdifici);
    setRisorse(nuoveRisorse);
    
    // Avanza mese e anno
    setMese((prevMese) => {
      const nuovoMese = prevMese + 1;
      if (nuovoMese > 12) {
        setAnno((prevAnno) => prevAnno + 1);
        return 1;
      }
      return nuovoMese;
    });
    
    setIsLoading(false);
  }, [abitanti, edifici, risorse]);

  const assegnaAbitanteAEdificio = useCallback((abitanteId: number, edificioId: number) => {
    setEdifici((prevEdifici) =>
      prevEdifici.map((edificio) => {
        if (edificio.id === edificioId) {
          // Controlla se l'abitante è già assegnato e se c'è spazio
          if (
            !edificio.abitantiAssegnati.includes(abitanteId) &&
            edificio.abitantiAssegnati.length < edificio.capacità &&
            edificio.stato === "Operativo"
          ) {
            return {
              ...edificio,
              abitantiAssegnati: [...edificio.abitantiAssegnati, abitanteId],
              occupazione: edificio.abitantiAssegnati.length + 1
            };
          }
        }
        return edificio;
      })
    );
  }, []);

  const rimuoviAbitanteDaEdificio = useCallback((abitanteId: number, edificioId: number) => {
    setEdifici((prevEdifici) =>
      prevEdifici.map((edificio) => {
        if (edificio.id === edificioId) {
          const nuoviAssegnati = edificio.abitantiAssegnati.filter((id) => id !== abitanteId);
          return {
            ...edificio,
            abitantiAssegnati: nuoviAssegnati,
            occupazione: nuoviAssegnati.length
          };
        }
        return edificio;
      })
    );
  }, []);

  return {
    abitanti,
    risorse,
    edifici,
    mese,
    anno,
    isLoading,
    avanzaMese,
    assegnaAbitanteAEdificio,
    rimuoviAbitanteDaEdificio
  };
}
