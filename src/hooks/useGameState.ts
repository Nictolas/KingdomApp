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
  const [abitantiProposti, setAbitantiProposti] = useState<Abitante[]>([]);
  const [nextId, setNextId] = useState(100); // ID iniziale per nuovi abitanti
  
  // Configurazione tassa sul reddito
  const [tipoTassaReddito, setTipoTassaReddito] = useState<"flat" | "scaglioni">("scaglioni");
  const [flatTaxPercentuale, setFlatTaxPercentuale] = useState(15); // Percentuale flat tax
  const [scaglioniConfig, setScaglioniConfig] = useState([
    { min: 0, max: 300, percentuale: 0 },
    { min: 301, max: 800, percentuale: 10 },
    { min: 801, max: 1500, percentuale: 20 },
    { min: 1501, max: Infinity, percentuale: 30 }
  ]);

  // Genera nuovi abitanti proposti per immigrazione
  const generaNuoviAbitantiProposti = useCallback(() => {
    const numNuovi = Math.floor(Math.random() * 6); // 0-5
    const nuoviAbitanti: Abitante[] = [];
    const fazioni = ["Amministrazione", "Lavoratori", "Scienziati", "Esploratori"];
    const lavori = [
      "Tecnico",
      "Ricercatore",
      "Ingegnere",
      "Medico",
      "Agricoltore",
      "Meccanico",
      "Esploratore",
      "Comunicatore",
      "Sicurezza",
      "Amministratore"
    ];
    const personalità = [
      "Curioso",
      "Lavoratore",
      "Analitico",
      "Creativo",
      "Pragmatico",
      "Idealista",
      "Deciso",
      "Collaborativo"
    ];
    const emojiUmani = ["👨", "👩", "👨‍🔬", "👩‍🔬", "👨‍💼", "👩‍💼", "👨‍🔧", "👩‍🔧", "👨‍🌾", "👩‍🌾"];
    const emojiAlieni = ["👽", "🛸", "🤖", "👾", "🦎", "🦑"];

    setNextId((prevId) => {
      for (let i = 0; i < numNuovi; i++) {
        const isAlieno = Math.random() < 0.3; // 30% probabilità di essere alieno
        const emoji = isAlieno
          ? emojiAlieni[Math.floor(Math.random() * emojiAlieni.length)]
          : emojiUmani[Math.floor(Math.random() * emojiUmani.length)];

        const nome = isAlieno
          ? `X'${Math.floor(Math.random() * 9999)}`
          : `${["Marco", "Luca", "Anna", "Sofia", "Giovanni", "Elena", "Alessandro", "Chiara"][Math.floor(Math.random() * 8)]} ${["Rossi", "Bianchi", "Verdi", "Neri", "Blu", "Gialli"][Math.floor(Math.random() * 6)]}`;

        const nuovoAbitante: Abitante = {
          id: prevId + i,
          nome,
          emoji,
          eta: 20 + Math.floor(Math.random() * 50),
          lavoro: lavori[Math.floor(Math.random() * lavori.length)],
          competenza: 30 + Math.floor(Math.random() * 70),
          produttività: 40 + Math.floor(Math.random() * 60),
          stanchezza: Math.floor(Math.random() * 50),
          personalità: personalità[Math.floor(Math.random() * personalità.length)],
          amici: [],
          rivali: [],
          fazione: fazioni[Math.floor(Math.random() * fazioni.length)],
          salute: 50 + Math.floor(Math.random() * 50),
          crediti: Math.floor(Math.random() * 1000),
          reddito: 100 + Math.floor(Math.random() * 500),
          spese: 50 + Math.floor(Math.random() * 300),
          lealtà: 30 + Math.floor(Math.random() * 50),
          paura: Math.floor(Math.random() * 40)
        };

        nuoviAbitanti.push(nuovoAbitante);
      }
      setAbitantiProposti(nuoviAbitanti);
      return prevId + numNuovi;
    });
  }, []);

  // Produzione fissa di cibo per abitante (10-20 razioni al mese, valore individuale costante)
  const getProduzioneCiboPerAbitante = (abitanteId: number): number => {
    const seed = abitanteId * 31;
    return 10 + (seed % 11); // 10-20
  };

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
                const numAbitanti = edificio.abitantiAssegnati.length;
                if (numAbitanti > 0) {
                  if (risorsa.nome.toLowerCase().includes("cibo")) {
                    // Cibo: ogni abitante assegnato produce un valore fisso (10-20) indipendente dal mese
                    const produzioneTotale = edificio.abitantiAssegnati.reduce((sum, id) => {
                      return sum + getProduzioneCiboPerAbitante(id);
                    }, 0);
                    nuovaQuantità += produzioneTotale;
                  } else {
                    // Altre risorse: produzione basata sulla produttività media (logica originale)
                    const produttivitàMedia = edificio.abitantiAssegnati.reduce((sum, id) => {
                      const abitante = nuoviAbitanti.find((a) => a.id === id);
                      return sum + (abitante?.produttività || 0);
                    }, 0) / numAbitanti;

                    const produzione = Math.floor(numAbitanti * (produttivitàMedia / 10));
                    nuovaQuantità += produzione;
                  }
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

      // Funzione per calcolare il consumo fisso di cibo (stessa logica del modal)
      const getConsumoFissoMese = (abitante: Abitante): number => {
        // Usa una combinazione di ID e salute per generare un numero deterministico
        const seed = abitante.id * 17 + abitante.salute * 23;
        
        if (abitante.salute > 70) {
          // Obeso: consuma da 5 a 10
          return 5 + (seed % 6); // 5 + (0-5) = 5-10
        } else if (abitante.salute >= 30 && abitante.salute <= 70) {
          // Normale: consuma da 1 a 5
          return 1 + (seed % 5); // 1 + (0-4) = 1-5
        } else {
          // Altro: consuma da 1 a 10
          return 1 + (seed % 10); // 1 + (0-9) = 1-10
        }
      };

      // Calcola consumo del cibo basato sulla salute degli abitanti
      if (risorsa.nome.toLowerCase().includes("cibo")) {
        nuoviAbitanti.forEach((abitante) => {
          const consumoCibo = getConsumoFissoMese(abitante);
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

    // Genera nuovi abitanti proposti per immigrazione
    generaNuoviAbitantiProposti();
    
    setIsLoading(false);
  }, [abitanti, edifici, risorse, generaNuoviAbitantiProposti]);

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
            // Trova la risorsa corrispondente
            risorse.forEach((r) => {
              if (prod === r.nome || r.nome.includes(prod) || prod.includes(r.nome)) {
                if (r.nome.toLowerCase().includes("cibo")) {
                  // Cibo: anteprima produzione fissa 10-20 per abitante (stessa logica della Serra)
                  const produzioneTotale = edificio.abitantiAssegnati.reduce((sum, id) => {
                    return sum + getProduzioneCiboPerAbitante(id);
                  }, 0);
                  variazioni[r.nome] = (variazioni[r.nome] || 0) + produzioneTotale;
                } else {
                  // Altre risorse: produzione basata sulla produttività media (logica originale)
                  const produttivitàMedia = edificio.abitantiAssegnati.reduce((sum, id) => {
                    const abitante = abitanti.find((a) => a.id === id);
                    return sum + (abitante?.produttività || 0);
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

    // Funzione per calcolare il consumo fisso di cibo (stessa logica del modal)
    const getConsumoFisso = (abitante: Abitante): number => {
      // Usa una combinazione di ID e salute per generare un numero deterministico
      const seed = abitante.id * 17 + abitante.salute * 23;
      
      if (abitante.salute > 70) {
        // Obeso: consuma da 5 a 10
        return 5 + (seed % 6); // 5 + (0-5) = 5-10
      } else if (abitante.salute >= 30 && abitante.salute <= 70) {
        // Normale: consuma da 1 a 5
        return 1 + (seed % 5); // 1 + (0-4) = 1-5
      } else {
        // Altro: consuma da 1 a 10
        return 1 + (seed % 10); // 1 + (0-9) = 1-10
      }
    };

    // Calcola consumo del cibo basato sulla salute degli abitanti
    abitanti.forEach((abitante) => {
      const consumoCibo = getConsumoFisso(abitante);
      
      // Trova la risorsa "Cibo"
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

  const accettaImmigrante = useCallback((abitanteId: number) => {
    const immigrante = abitantiProposti.find((a) => a.id === abitanteId);
    if (immigrante) {
      setAbitanti((prev) => [...prev, immigrante]);
      setAbitantiProposti((prev) => prev.filter((a) => a.id !== abitanteId));
    }
  }, [abitantiProposti]);

  const rifiutaImmigrante = useCallback((abitanteId: number) => {
    setAbitantiProposti((prev) => prev.filter((a) => a.id !== abitanteId));
  }, []);

  return {
    abitanti,
    risorse,
    edifici,
    mese,
    anno,
    isLoading,
    abitantiProposti,
    tipoTassaReddito,
    flatTaxPercentuale,
    scaglioniConfig,
    setTipoTassaReddito,
    setFlatTaxPercentuale,
    setScaglioniConfig,
    avanzaMese,
    assegnaAbitanteAEdificio,
    rimuoviAbitanteDaEdificio,
    nominaMinistro,
    rimuoviMinistro,
    calcolaProduzioneConsumo,
    accettaImmigrante,
    rifiutaImmigrante
  };
}
