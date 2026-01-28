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

      // Calcola consumo del cibo basato sulla salute degli abitanti
      if (risorsa.nome.toLowerCase().includes("cibo")) {
        nuoviAbitanti.forEach((abitante) => {
          let consumoCibo: number;
          
          // Determina consumo basato sulla salute
          if (abitante.salute > 70) {
            // Obeso: consuma da 5 a 10
            consumoCibo = 5 + Math.floor(Math.random() * 6);
          } else if (abitante.salute >= 30 && abitante.salute <= 70) {
            // Normale: consuma da 1 a 5
            consumoCibo = 1 + Math.floor(Math.random() * 5);
          } else {
            // Altro: consuma da 1 a 10
            consumoCibo = 1 + Math.floor(Math.random() * 10);
          }
          
          nuovaQuantità -= consumoCibo;
        });
      }

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

  const nominaMinistro = useCallback((abitanteId: number, ministero: string) => {
    setAbitanti((prevAbitanti) =>
      prevAbitanti.map((abitante) => {
        // Rimuovi il ministero da chiunque lo avesse
        if (abitante.ministero === ministero) {
          const { ministero: _, ...rest } = abitante;
          return rest;
        }
        // Assegna il ministero al nuovo abitante
        if (abitante.id === abitanteId) {
          return {
            ...abitante,
            ministero
          };
        }
        return abitante;
      })
    );
  }, []);

  const rimuoviMinistro = useCallback((abitanteId: number) => {
    setAbitanti((prevAbitanti) =>
      prevAbitanti.map((abitante) => {
        if (abitante.id === abitanteId) {
          const { ministero: _, ...rest } = abitante;
          return rest;
        }
        return abitante;
      })
    );
  }, []);

  // Calcola produzione/consumo mensile per ogni risorsa
  const calcolaProduzioneConsumo = useCallback(() => {
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
            const produttivitàMedia = edificio.abitantiAssegnati.reduce((sum, id) => {
              const abitante = abitanti.find((a) => a.id === id);
              return sum + (abitante?.produttività || 0);
            }, 0) / numAbitanti;
            
            const produzione = Math.floor(numAbitanti * (produttivitàMedia / 10));
            
            // Trova la risorsa corrispondente
            risorse.forEach((r) => {
              if (prod === r.nome || r.nome.includes(prod) || prod.includes(r.nome)) {
                variazioni[r.nome] = (variazioni[r.nome] || 0) + produzione;
              }
            });
          }
        });
      }
    });

    // Calcola consumo del cibo basato sulla salute degli abitanti
    // Per la visualizzazione, usiamo valori medi deterministici
    abitanti.forEach((abitante) => {
      let consumoCibo: number;
      
      // Determina consumo basato sulla salute (valore medio per visualizzazione)
      if (abitante.salute > 70) {
        // Obeso: consuma da 5 a 10 (media: 7.5, arrotondato a 8)
        consumoCibo = 8;
      } else if (abitante.salute >= 30 && abitante.salute <= 70) {
        // Normale: consuma da 1 a 5 (media: 3)
        consumoCibo = 3;
      } else {
        // Altro: consuma da 1 a 10 (media: 5.5, arrotondato a 6)
        consumoCibo = 6;
      }
      
      // Trova la risorsa "Cibo" o "Cibo sintetico"
      risorse.forEach((r) => {
        if (r.nome.toLowerCase().includes("cibo")) {
          variazioni[r.nome] = (variazioni[r.nome] || 0) - consumoCibo;
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

    // Calcola variazioni per i crediti
    const totaleRedditi = abitanti.reduce((sum, a) => sum + a.reddito, 0);
    const totaleSpese = abitanti.reduce((sum, a) => sum + a.spese, 0);
    const totaleManutenzione = edifici
      .filter((e) => e.stato === "Operativo")
      .reduce((sum, e) => sum + e.manutenzione, 0);
    
    risorse.forEach((r) => {
      if (r.nome === "Crediti") {
        variazioni[r.nome] = totaleRedditi - totaleSpese - totaleManutenzione;
      }
    });

    return variazioni;
  }, [abitanti, edifici, risorse]);

  return {
    abitanti,
    risorse,
    edifici,
    mese,
    anno,
    isLoading,
    avanzaMese,
    assegnaAbitanteAEdificio,
    rimuoviAbitanteDaEdificio,
    nominaMinistro,
    rimuoviMinistro,
    calcolaProduzioneConsumo
  };
}
