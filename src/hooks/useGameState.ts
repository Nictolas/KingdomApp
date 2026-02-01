import { useState, useCallback, useEffect } from "react";
import type { Abitante, Risorsa, Edificio, OrdineMercato, EventoInCorso, Razza } from "../types";
import { abitantiData, risorseData, edificiData, pianetiData } from "../kingdomData";
import { EVENTI_CATALOGO } from "../game/eventi";
import { getConsumoCibo, getProduzioneCiboPerAbitante } from "../game/ciboConsumo";

const RAZZE_NON_UMANE: Razza[] = ["Grigi", "Nordici", "Rettiliani", "Insettoidi", "Marini", "Ferini"];

function inizializzaAbitanti(): { abitanti: Abitante[]; razzaNativi: Razza } {
  const razzaNativi = RAZZE_NON_UMANE[Math.floor(Math.random() * RAZZE_NON_UMANE.length)];
  const abitanti = abitantiData.map((a) => {
    let razza = a.razza;
    if (a.fazioni?.includes("Nativi")) {
      razza = razzaNativi;
    }
    if (a.ruoloSchiavitu === "schiavo") {
      razza = RAZZE_NON_UMANE[Math.floor(Math.random() * RAZZE_NON_UMANE.length)];
    }
    const razzaFinale = razza ?? a.razza;
    const specie = (razzaFinale ?? "Umano") === "Umano" ? "umano" : "alieno";
    return { ...a, razza: razzaFinale, specie };
  });
  return { abitanti, razzaNativi };
}

const statoIniziale = inizializzaAbitanti();

export function useGameState() {
  const [abitanti, setAbitanti] = useState<Abitante[]>(statoIniziale.abitanti);
  const [razzaNativi] = useState<Razza>(statoIniziale.razzaNativi);
  const [risorse, setRisorse] = useState<Risorsa[]>(risorseData);
  const [edifici, setEdifici] = useState<Edificio[]>(edificiData);
  const [mese, setMese] = useState(1);
  const [anno, setAnno] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [abitantiProposti, setAbitantiProposti] = useState<Abitante[]>([]);
  const [nextId, setNextId] = useState(100); // ID iniziale per nuovi abitanti
  const [ordiniMercato, setOrdiniMercato] = useState<OrdineMercato[]>([]);
  const [eventiInCorso, setEventiInCorso] = useState<EventoInCorso[]>([]);
  const [nativiNonIntegrati, setNativiNonIntegrati] = useState(() => 100 + Math.floor(Math.random() * 101));
  const [pendingAssimilazione, setPendingAssimilazione] = useState<number | null>(null);

  // Configurazione tassa sul reddito
  const [tipoTassaReddito, setTipoTassaReddito] = useState<"flat" | "scaglioni">("scaglioni");
  const [flatTaxPercentuale, setFlatTaxPercentuale] = useState(15); // Percentuale flat tax
  const [scaglioniConfig, setScaglioniConfig] = useState([
    { min: 0, max: 300, percentuale: 0 },
    { min: 301, max: 800, percentuale: 10 },
    { min: 801, max: 1500, percentuale: 20 },
    { min: 1501, max: Infinity, percentuale: 30 }
  ]);
  
  // Configurazione politica sulle nascite
  const [politicaNascite, setPoliticaNascite] = useState<"figlio-unico" | "incentivi" | "nessuna">("nessuna");
  
  // Sistema sanzioni (punteggio da 1 a 10)
  const [punteggioSanzioni, setPunteggioSanzioni] = useState(1);
  const [penaDiMorteAttiva, setPenaDiMorteAttiva] = useState(false);
  
  // Configurazione politica religiosa
  const [politicaReligiosa, setPoliticaReligiosa] = useState<"ateismo-stato" | "religione-stato" | "liberta-culto">("liberta-culto");
  const [religioneDiStato, setReligioneDiStato] = useState<"Ateo" | "Deista" | "Agnostico" | "Culto del Sole" | "Culto degli Alieni" | null>(null);
  
  // Capo religioso e fedeli per ogni culto
  const [capoReligiosoSole, setCapoReligiosoSole] = useState<number | null>(null); // ID abitante
  const [capoReligiosoAlieni, setCapoReligiosoAlieni] = useState<number | null>(null); // ID abitante
  
  // Configurazione legge razziale
  const [leggeRazzialeAttiva, setLeggeRazzialeAttiva] = useState(false);
  const [razzaCampoLavoro, setRazzaCampoLavoro] = useState<Razza | null>(null);
  const [razzaCampoSterminio, setRazzaCampoSterminio] = useState<Razza | null>(null);
  
  // Configurazione età minima sul lavoro
  const [etaMinimaLavoro, setEtaMinimaLavoro] = useState(18); // Età minima di default
  
  // Configurazione legge sulle droghe
  const [leggeDroghe, setLeggeDroghe] = useState<"vietate" | "legali" | "parziali">("vietate"); // Stato delle droghe
  
  // Configurazione divieto di espatrio
  const [divietoEspatrioAttivo, setDivietoEspatrioAttivo] = useState(false);
  
  // Configurazione legge sulle famiglie
  const [tipologieFamigliaAccettate, setTipologieFamigliaAccettate] = useState<{
    tradizionale: boolean;
    interrazziale: boolean;
    arcobaleno: boolean;
    monogenitoriale: boolean;
  }>({
    tradizionale: true,
    interrazziale: true,
    arcobaleno: true,
    monogenitoriale: true
  });

  // Genera nuovi abitanti proposti per immigrazione
  const generaNuoviAbitantiProposti = useCallback(() => {
    const numNuovi = Math.floor(Math.random() * 6); // 0-5
    const nuoviAbitanti: Abitante[] = [];
    const fazioniRuolo = ["Amministrazione", "Lavoratori", "Scienziati", "Esploratori"];
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
    const razze: Razza[] = ["Umano", "Grigi", "Nordici", "Rettiliani", "Insettoidi", "Marini", "Ferini"];
    const emojiUmani = ["👨", "👩", "👨‍🔬", "👩‍🔬", "👨‍💼", "👩‍💼", "👨‍🔧", "👩‍🔧", "👨‍🌾", "👩‍🌾"];
    const nomiUmani = ["Marco", "Luca", "Anna", "Sofia", "Giovanni", "Elena", "Alessandro", "Chiara"];
    const cognomiUmani = ["Rossi", "Bianchi", "Verdi", "Neri", "Blu", "Gialli"];
    const religioni: Abitante["religione"][] = ["Ateo", "Deista", "Agnostico", "Culto del Sole", "Culto degli Alieni"];

    setNextId((prevId) => {
      for (let i = 0; i < numNuovi; i++) {
        const razza = razze[Math.floor(Math.random() * razze.length)];
        const isUmano = razza === "Umano";
        const emoji = isUmano
          ? emojiUmani[Math.floor(Math.random() * emojiUmani.length)]
          : pianetiData.find((p) => p.razza === razza)?.emoji ?? "👽";
        const nome = isUmano
          ? `${nomiUmani[Math.floor(Math.random() * nomiUmani.length)]} ${cognomiUmani[Math.floor(Math.random() * cognomiUmani.length)]}`
          : `${razza}-${Math.floor(Math.random() * 9999)}`;

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
          fazioni: [fazioniRuolo[Math.floor(Math.random() * fazioniRuolo.length)], "Cittadini"],
          peso: 41 + Math.floor(Math.random() * 40),
          salute: 50 + Math.floor(Math.random() * 50),
          crediti: Math.floor(Math.random() * 1000),
          reddito: 100 + Math.floor(Math.random() * 500),
          spese: 50 + Math.floor(Math.random() * 300),
          lealtà: 30 + Math.floor(Math.random() * 50),
          paura: Math.floor(Math.random() * 40),
          felicità: 40 + Math.floor(Math.random() * 50),
          religione: religioni[Math.floor(Math.random() * religioni.length)],
          razza,
          specie: isUmano ? "umano" : "alieno"
        };

        nuoviAbitanti.push(nuovoAbitante);
      }
      setAbitantiProposti(nuoviAbitanti);
      return prevId + numNuovi;
    });
  }, []);

  // Calcola la felicità modificata in base alla politica religiosa e altre leggi
  const calcolaFelicitàModificata = useCallback(
    (abitante: Abitante): number => {
      let felicitàBase = abitante.felicità;

      if (politicaReligiosa === "ateismo-stato") {
        // Atei +10% felici
        if (abitante.religione === "Ateo") {
          felicitàBase = Math.min(100, felicitàBase + 10);
        }
      } else if (politicaReligiosa === "liberta-culto") {
        // Deisti +10% felici
        if (abitante.religione === "Deista") {
          felicitàBase = Math.min(100, felicitàBase + 10);
        }
      } else if (politicaReligiosa === "religione-stato" && religioneDiStato) {
        // Tutti -10% felici, tranne quelli della religione di stato +20% felici
        if (abitante.religione === religioneDiStato) {
          felicitàBase = Math.min(100, felicitàBase + 20);
        } else {
          felicitàBase = Math.max(1, felicitàBase - 10);
        }
      }

      // Mafia +10% felici se tutte le droghe sono vietate
      if (abitante.fazioni?.includes("Mafia") && leggeDroghe === "vietate") {
        felicitàBase = Math.min(100, felicitàBase + 10);
      }

      // Limita tra 1 e 100
      return Math.min(Math.max(felicitàBase, 1), 100);
    },
    [politicaReligiosa, religioneDiStato, leggeDroghe]
  );

  const avanzaMese = useCallback(async () => {
    setIsLoading(true);

    // Simula un caricamento per rendere l'aggiornamento visibile
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Logica di emigrazione: se gli abitanti hanno felicità <= 10 e almeno 100 crediti,
    // c'è il 50% di probabilità che se ne vadano, a meno che non sia attivo il Divieto di espatrio
    let abitantiRimasti = abitanti;
    if (!divietoEspatrioAttivo) {
      abitantiRimasti = abitanti.filter((abitante) => {
        const felicitàModificata = calcolaFelicitàModificata(abitante);
        const puòEmigrare = felicitàModificata <= 10 && abitante.crediti >= 100;
        if (puòEmigrare) {
          // 50% di probabilità di emigrare
          return Math.random() >= 0.5;
        }
        return true; // Non può emigrare, resta
      });
    }

    // Aggiorna gli abitanti
    const nuoviAbitanti = abitantiRimasti.map((abitante) => {
      // Calcola il nuovo saldo (reddito - spese)
      const nuovoSaldo = abitante.crediti + abitante.reddito - abitante.spese;
      
      // Aggiorna la stanchezza (aumenta leggermente, ma non oltre 100)
      const nuovaStanchezza = Math.min(100, abitante.stanchezza + Math.floor(Math.random() * 10));
      
      // Aggiorna peso e salute (possono variare leggermente)
      const variazionePeso = Math.floor(Math.random() * 6) - 2; // -2 a +3
      const nuovoPeso = Math.max(0, Math.min(100, abitante.peso + variazionePeso));
      const variazioneSalute = Math.floor(Math.random() * 6) - 2;
      const nuovaSalute = Math.max(0, Math.min(100, abitante.salute + variazioneSalute));

      return {
        ...abitante,
        crediti: Math.max(0, nuovoSaldo),
        stanchezza: nuovaStanchezza,
        peso: nuovoPeso,
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

      // Calcola consumo del cibo basato sulla salute degli abitanti (4 categorie peso)
      if (risorsa.nome.toLowerCase().includes("cibo")) {
        nuoviAbitanti.forEach((abitante) => {
          nuovaQuantità -= getConsumoCibo(abitante);
        });
      }

      return {
        ...risorsa,
        quantità: Math.max(0, nuovaQuantità)
      };
    });

    // Nativi non integrati: aumenta di 0-5 ogni mese
    setNativiNonIntegrati((prev) => prev + Math.floor(Math.random() * 6));

    // Eventi: calcola prossimo mese/anno, applica effetti mensili, rimuovi scaduti, attiva nuovi se condizioni ok
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
    if (assimilazioneAppenaAggiunto) {
      setPendingAssimilazione(1 + Math.floor(Math.random() * 3));
    }

    setEventiInCorso(nuoviEventiInCorso);

    // Esegui ordini Mercato (acquisti/vendite) al cambio mese
    let risorseDopoOrdini = [...risorseEv];
    ordiniMercato.forEach((ordine) => {
      const creditiId = 1;
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
    setOrdiniMercato([]);

    // Applica tutti gli aggiornamenti
    setAbitanti(abitantiEv);
    setEdifici(edificiEv);
    setRisorse(risorseDopoOrdini);
    
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
  }, [abitanti, edifici, risorse, ordiniMercato, eventiInCorso, punteggioSanzioni, mese, anno, generaNuoviAbitantiProposti, divietoEspatrioAttivo, calcolaFelicitàModificata]);

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

  const accettaAssimilazione = useCallback(() => {
    const count = pendingAssimilazione ?? 0;
    setPendingAssimilazione(null);
    if (count <= 0) return;
    const emojiNativo = pianetiData.find((p) => p.razza === razzaNativi)?.emoji ?? "🌿";
    const lavori = ["Tecnico", "Agricoltore", "Meccanico", "Esploratore", "Comunicatore"];
    const personalità = ["Curioso", "Lavoratore", "Pragmatico", "Collaborativo"];
    const religioni: Abitante["religione"][] = ["Ateo", "Deista", "Culto del Sole"];
    setNextId((prevId) => {
      const nuovi: Abitante[] = [];
      for (let i = 0; i < count; i++) {
        nuovi.push({
          id: prevId + i,
          nome: `${razzaNativi}-${prevId + i}`,
          emoji: emojiNativo,
          eta: 18 + Math.floor(Math.random() * 40),
          lavoro: lavori[Math.floor(Math.random() * lavori.length)],
          competenza: 30 + Math.floor(Math.random() * 50),
          produttività: 50 + Math.floor(Math.random() * 40),
          stanchezza: Math.floor(Math.random() * 40),
          personalità: personalità[Math.floor(Math.random() * personalità.length)],
          amici: [],
          rivali: [],
          fazioni: ["Nativi", "Cittadini"],
          peso: 41 + Math.floor(Math.random() * 40),
          salute: 60 + Math.floor(Math.random() * 35),
          crediti: Math.floor(Math.random() * 500),
          reddito: 100 + Math.floor(Math.random() * 300),
          spese: 50 + Math.floor(Math.random() * 150),
          lealtà: 40 + Math.floor(Math.random() * 40),
          paura: Math.floor(Math.random() * 30),
          felicità: 50 + Math.floor(Math.random() * 40),
          religione: religioni[Math.floor(Math.random() * religioni.length)],
          razza: razzaNativi,
          specie: "alieno"
        });
      }
      setAbitanti((prev) => [...prev, ...nuovi]);
      return prevId + count;
    });
  }, [pendingAssimilazione, razzaNativi]);

  const rifiutaAssimilazione = useCallback(() => {
    setPendingAssimilazione(null);
  }, []);

  // Tribunale: grazia un criminale → lui e Amici +10% Lealtà, Nemici (rivali) -10% Lealtà; reati azzerati
  const graziaCriminale = useCallback((abitanteId: number) => {
    setAbitanti((prev) => {
      const criminale = prev.find((a) => a.id === abitanteId);
      if (!criminale || !criminale.reati?.length) return prev;
      const idsBonus = new Set<number>([criminale.id, ...(criminale.amici ?? [])]);
      const idsMalus = new Set<number>(criminale.rivali ?? []);
      return prev.map((a) => {
        let lealtà = a.lealtà;
        if (idsBonus.has(a.id)) lealtà = Math.min(100, Math.round(a.lealtà * 1.1));
        if (idsMalus.has(a.id)) lealtà = Math.max(0, Math.round(a.lealtà * 0.9));
        const reati = a.id === abitanteId ? [] : a.reati;
        return { ...a, lealtà, reati: reati ?? a.reati };
      });
    });
  }, []);

  // Mercato: ordini di acquisto/vendita; si eseguono solo al cambio mese (Skip Mese)
  const aggiungiOrdineMercato = useCallback(
    (tipo: "compra" | "vendi", risorsaId: number, quantità: number, prezzoUnitario: number): boolean => {
      const creditiId = 1;
      if (risorsaId === creditiId || quantità <= 0 || prezzoUnitario <= 0) return false;
      const crediti = risorse.find((r) => r.id === creditiId);
      const risorsa = risorse.find((r) => r.id === risorsaId);
      if (!crediti || !risorsa) return false;
      if (tipo === "compra") {
        const costo = quantità * prezzoUnitario;
        const creditiImpegnati = ordiniMercato
          .filter((o) => o.tipo === "compra")
          .reduce((s, o) => s + o.quantità * o.prezzoUnitario, 0);
        if (crediti.quantità - creditiImpegnati < costo) return false;
      } else {
        const qtàGiàInVendita = ordiniMercato
          .filter((o) => o.tipo === "vendi" && o.risorsaId === risorsaId)
          .reduce((s, o) => s + o.quantità, 0);
        if (risorsa.quantità - qtàGiàInVendita < quantità) return false;
      }
      setOrdiniMercato((prev) => {
        const newId = prev.length === 0 ? 1 : Math.max(...prev.map((o) => o.id)) + 1;
        return [...prev, { id: newId, tipo, risorsaId, quantità, prezzoUnitario }];
      });
      return true;
    },
    [risorse, ordiniMercato]
  );

  const rimuoviOrdineMercato = useCallback((ordineId: number) => {
    setOrdiniMercato((prev) => prev.filter((o) => o.id !== ordineId));
  }, []);

  // Delta risorse dall'anteprima ordini (per mostrare in Home l'effetto al cambio mese)
  const calcolaDeltaOrdiniMercato = useCallback((): Record<string, number> => {
    const delta: Record<string, number> = {};
    ordiniMercato.forEach((ordine) => {
      const creditiId = 1;
      const risorsa = risorse.find((r) => r.id === ordine.risorsaId);
      const nomeRisorsa = risorsa?.nome ?? "";
      const nomeCrediti = risorse.find((r) => r.id === creditiId)?.nome ?? "Crediti";
      if (ordine.tipo === "compra") {
        const costo = ordine.quantità * ordine.prezzoUnitario;
        delta[nomeRisorsa] = (delta[nomeRisorsa] ?? 0) + ordine.quantità;
        delta[nomeCrediti] = (delta[nomeCrediti] ?? 0) - costo;
      } else {
        const ricavo = ordine.quantità * ordine.prezzoUnitario;
        delta[nomeRisorsa] = (delta[nomeRisorsa] ?? 0) - ordine.quantità;
        delta[nomeCrediti] = (delta[nomeCrediti] ?? 0) + ricavo;
      }
    });
    return delta;
  }, [ordiniMercato, risorse]);

  // Calcola il punteggio sanzioni basato sulle leggi attive
  const calcolaPunteggioSanzioni = useCallback(() => {
    let punteggio = 1; // Punteggio base
    
    // +1 se ci sono schiavisti o schiavi
    const haSchiavitu = abitanti.some((a) => a.ruoloSchiavitu === "schiavista" || a.ruoloSchiavitu === "schiavo");
    if (haSchiavitu) {
      punteggio += 1;
    }
    
    // +1 se la pena di morte è attiva
    if (penaDiMorteAttiva) {
      punteggio += 1;
    }
    
    // +1 se il campo di lavoro è attivo
    if (razzaCampoLavoro !== null) {
      punteggio += 1;
    }
    
    // +1 se il campo di sterminio è attivo
    if (razzaCampoSterminio !== null) {
      punteggio += 1;
    }
    
    // +1 se l'età minima sul lavoro è 13 o inferiore
    if (etaMinimaLavoro <= 13) {
      punteggio += 1;
    }
    
    // +1 se il divieto di espatrio è attivo
    if (divietoEspatrioAttivo) {
      punteggio += 1;
    }
    
    // Limita tra 1 e 10
    return Math.min(Math.max(punteggio, 1), 10);
  }, [abitanti, penaDiMorteAttiva, razzaCampoLavoro, razzaCampoSterminio, etaMinimaLavoro, divietoEspatrioAttivo]);

  // Aggiorna il punteggio quando cambiano le condizioni
  useEffect(() => {
    const nuovoPunteggio = calcolaPunteggioSanzioni();
    setPunteggioSanzioni(nuovoPunteggio);
  }, [calcolaPunteggioSanzioni]);

  return {
    abitanti,
    risorse,
    edifici,
    mese,
    anno,
    isLoading,
    razzaNativi,
    abitantiProposti,
    tipoTassaReddito,
    flatTaxPercentuale,
    scaglioniConfig,
    politicaNascite,
    punteggioSanzioni,
    penaDiMorteAttiva,
    politicaReligiosa,
    leggeRazzialeAttiva,
    razzaCampoLavoro,
    razzaCampoSterminio,
    capoReligiosoSole,
    capoReligiosoAlieni,
    religioneDiStato,
    etaMinimaLavoro,
    leggeDroghe,
    divietoEspatrioAttivo,
    tipologieFamigliaAccettate,
    setTipoTassaReddito,
    setFlatTaxPercentuale,
    setScaglioniConfig,
    setPoliticaNascite,
    setPenaDiMorteAttiva,
    setPoliticaReligiosa,
    setReligioneDiStato,
    setLeggeRazzialeAttiva,
    setRazzaCampoLavoro,
    setRazzaCampoSterminio,
    setCapoReligiosoSole,
    setCapoReligiosoAlieni,
    setEtaMinimaLavoro,
    setLeggeDroghe,
    setDivietoEspatrioAttivo,
    setTipologieFamigliaAccettate,
    calcolaFelicitàModificata,
    avanzaMese,
    assegnaAbitanteAEdificio,
    rimuoviAbitanteDaEdificio,
    nominaMinistro,
    rimuoviMinistro,
    calcolaProduzioneConsumo,
    accettaImmigrante,
    rifiutaImmigrante,
    ordiniMercato,
    aggiungiOrdineMercato,
    rimuoviOrdineMercato,
    calcolaDeltaOrdiniMercato,
    graziaCriminale,
    nativiNonIntegrati,
    pendingAssimilazione,
    accettaAssimilazione,
    rifiutaAssimilazione,
    eventiInCorso,
    eventiCatalogo: EVENTI_CATALOGO
  };
}
