import { useState, useCallback, useEffect, useRef } from "react";
import { Alert } from "react-native";
import type { Abitante, Risorsa, Edificio, OrdineMercato, EventoInCorso, Razza } from "../types";
import { risorseData, edificiData, pianetiData, getEmojiRazza } from "../kingdomData";
import { getConsumoCibo, getConsumoAcqua, getProduzioneCiboPerAbitante } from "../game/ciboConsumo";
import { runAvanzaMese } from "../game/avanzaMese";
import { EVENTI_CATALOGO } from "../game/eventi/index";
import { generaColoniaIniziale } from "../game/generazionePartita";
import { generaNomeAlieno } from "../game/nomiAlieni";

const statoIniziale = generaColoniaIniziale();

export function useGameState() {
  const [abitanti, setAbitanti] = useState<Abitante[]>(statoIniziale.abitanti);
  const [razzaNativi] = useState<Razza>(statoIniziale.razzaNativi);
  const [risorse, setRisorse] = useState<Risorsa[]>(risorseData);
  const [edifici, setEdifici] = useState<Edificio[]>(() => {
    const tuttiId = statoIniziale.abitanti.map((a) => a.id);
    const metà = Math.floor(tuttiId.length / 2);
    const baraccaIds = tuttiId.slice(0, metà);
    const dormitorioIds = tuttiId.slice(metà);
    const agricoltore = statoIniziale.abitanti.find((a) => a.lavoro === "Agricoltore");
    const serraIds = agricoltore ? [agricoltore.id] : [];
    const prigionieriIds = statoIniziale.abitanti.filter((a) => a.lavoro === "Prigioniero").map((a) => a.id);
    return edificiData.map((e) => {
      if (e.id === 4) return { ...e, abitantiAssegnati: baraccaIds, occupazione: baraccaIds.length };
      if (e.id === 14) return { ...e, abitantiAssegnati: dormitorioIds, occupazione: dormitorioIds.length };
      if (e.id === 2) return { ...e, abitantiAssegnati: serraIds, occupazione: serraIds.length };
      if (e.id === 9) return { ...e, abitantiAssegnati: prigionieriIds, occupazione: prigionieriIds.length };
      return e;
    });
  });
  const [mese, setMese] = useState(1);
  const [anno, setAnno] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [abitantiProposti, setAbitantiProposti] = useState<Abitante[]>([]);
  const [nextId, setNextId] = useState(statoIniziale.abitanti.length + 100); // ID iniziale per nuovi abitanti
  const [ordiniMercato, setOrdiniMercato] = useState<OrdineMercato[]>([]);
  const [eventiInCorso, setEventiInCorso] = useState<EventoInCorso[]>([]);
  const [nativiNonIntegrati, setNativiNonIntegrati] = useState(() => 100 + Math.floor(Math.random() * 101));
  const [pendingAssimilazione, setPendingAssimilazione] = useState<number | null>(null);
  const [pendingMatrimonio, setPendingMatrimonio] = useState<{ idA: number; idB: number; nomeA: string; nomeB: string } | null>(null);
  const [messaggioEmigrazione, setMessaggioEmigrazione] = useState<string | null>(null);

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
  const [penaDiMorteAttiva, setPenaDiMorteAttiva] = useState(true);
  
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

  // Ius primae noctis: se attivo aggiunge +1 alle sanzioni; in evento Matrimonio permette di scegliere uno dei due e 50% incinta se sesso opposto al Comandante
  const [iusPrimaeNoctisAttivo, setIusPrimaeNoctisAttivo] = useState(false);
  
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
    // Robot non appaiono tra gli immigrati (solo in colonia a inizio partita o per altri eventi)
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
          : getEmojiRazza(razza);
        const nome = isUmano
          ? `${nomiUmani[Math.floor(Math.random() * nomiUmani.length)]} ${cognomiUmani[Math.floor(Math.random() * cognomiUmani.length)]}`
          : generaNomeAlieno(razza);

        const fazioniIniziali =
          razza === "Robot"
            ? ["Robots", "Cittadini"]
            : [fazioniRuolo[Math.floor(Math.random() * fazioniRuolo.length)], "Cittadini"];

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
          fazioni: fazioniIniziali,
          peso: 41 + Math.floor(Math.random() * 40),
          salute: 50 + Math.floor(Math.random() * 50),
          crediti: 800 + Math.floor(Math.random() * 401),
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
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const result = runAvanzaMese({
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
    });

    setNativiNonIntegrati((prev) => prev + result.deltaNativiNonIntegrati);
    if (result.pendingAssimilazione != null) setPendingAssimilazione(result.pendingAssimilazione);
    if (result.pendingMatrimonio != null) setPendingMatrimonio(result.pendingMatrimonio);
    setEventiInCorso(result.eventiInCorso);
    setAbitanti(result.abitanti);
    setEdifici(result.edifici);
    setRisorse(result.risorse);
    setMese(result.nuovoMese);
    setAnno(result.nuovoAnno);
    setOrdiniMercato([]);
    generaNuoviAbitantiProposti();
    setIsLoading(false);
    (result.vittimeOmicidi ?? []).forEach((v) => {
      Alert.alert("Omicidio", `È stato trovato il cadavere di ${v.nome}.`);
    });
    if (result.messaggioEmigrazione) {
      setMessaggioEmigrazione(result.messaggioEmigrazione);
    }
  }, [abitanti, edifici, risorse, ordiniMercato, eventiInCorso, punteggioSanzioni, mese, anno, generaNuoviAbitantiProposti, divietoEspatrioAttivo, calcolaFelicitàModificata]);

  const confermaMatrimonio = useCallback((idA: number, idB: number) => {
    setAbitanti((prev) =>
      prev.map((a) =>
        a.id === idA ? { ...a, coniugeId: idB } : a.id === idB ? { ...a, coniugeId: idA } : a
      )
    );
    setPendingMatrimonio(null);
  }, []);

  const rifiutaMatrimonio = useCallback(() => {
    setPendingMatrimonio(null);
  }, []);

  /** Esercita Ius primae noctis su un abitante (evento Matrimonio): se sesso opposto al Comandante, 50% diventa incinta. Poi chiude il matrimonio. */
  const esercitaIusPrimaeNoctis = useCallback(
    (abitanteId: number) => {
      const comandante = abitanti.find((a) => a.id === 1);
      const scelto = abitanti.find((a) => a.id === abitanteId);
      if (!scelto || scelto.razza === "Robot") {
        setPendingMatrimonio(null);
        return;
      }
      const sessoComandante = comandante?.sesso ?? "M";
      const sessoScelto = scelto.sesso ?? "F";
      const opposto = (sessoComandante === "M" && sessoScelto === "F") || (sessoComandante === "F" && sessoScelto === "M");
      if (opposto && Math.random() < 0.5) {
        setAbitanti((prev) => prev.map((a) => (a.id === abitanteId ? { ...a, incinta: true } : a)));
      }
      setPendingMatrimonio(null);
    },
    [abitanti]
  );

  const pendingMatrimonioShownRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingMatrimonio) {
      pendingMatrimonioShownRef.current = null;
      return;
    }
    const key = `${pendingMatrimonio.idA}-${pendingMatrimonio.idB}`;
    if (pendingMatrimonioShownRef.current === key) return;
    pendingMatrimonioShownRef.current = key;

    const buttons: { text: string; onPress: () => void }[] = [
      { text: "No", onPress: rifiutaMatrimonio },
      { text: "Sì", onPress: () => confermaMatrimonio(pendingMatrimonio!.idA, pendingMatrimonio!.idB) }
    ];
    if (iusPrimaeNoctisAttivo) {
      buttons.push({
        text: "Utilizza Ius primae noctis",
        onPress: () => {
          Alert.alert(
            "Ius primae noctis",
            "Su chi eserciti il diritto?",
            [
              { text: pendingMatrimonio!.nomeA, onPress: () => esercitaIusPrimaeNoctis(pendingMatrimonio!.idA) },
              { text: pendingMatrimonio!.nomeB, onPress: () => esercitaIusPrimaeNoctis(pendingMatrimonio!.idB) }
            ]
          );
        }
      });
    }

    Alert.alert(
      "Matrimonio",
      `${pendingMatrimonio.nomeA} e ${pendingMatrimonio.nomeB} vogliono sposarsi. Glielo concedi?`,
      buttons
    );
  }, [pendingMatrimonio, confermaMatrimonio, rifiutaMatrimonio, iusPrimaeNoctisAttivo, esercitaIusPrimaeNoctis]);

  /** Dialog in-game a inizio partita: prima riga del Diario + ex governatore in Tribunale (niente alert browser). */
  const [alertInizioPartita, setAlertInizioPartita] = useState<{
    titolo: string;
    messaggio: string;
  } | null>(null);
  const haMostratoAlertInizioRef = useRef(false);
  useEffect(() => {
    if (haMostratoAlertInizioRef.current) return;
    haMostratoAlertInizioRef.current = true;
    const primaRigaDiario = "Complimenti, hai appena concluso la Rivoluzione contro la Madre Patria.";
    const messaggioExGovernatore =
      "L'ex governatore è in Tribunale, puoi sceglierlo di graziarlo, condannarlo a morte o pensarci più tardi.";
    const titolo = "Diario";
    const messaggio = `${primaRigaDiario}\n\n${messaggioExGovernatore}`;
    const t = setTimeout(() => setAlertInizioPartita({ titolo, messaggio }), 100);
    return () => clearTimeout(t);
  }, []);
  const chiudiAlertInizioPartita = useCallback(() => setAlertInizioPartita(null), []);
  const chiudiMessaggioEmigrazione = useCallback(() => setMessaggioEmigrazione(null), []);

  /** Edifici di lavoro: assegnando un abitante qui il suo "lavoro" viene aggiornato. Rimuovendolo torna "Disoccupato". */
  const EDIFICIO_TO_LAVORO: Record<number, string> = { 2: "Agricoltore", 15: "Operatore" }; // 2 = Serra, 15 = Dissalatore
  const LAVORI_DA_EDIFICIO = new Set(Object.values(EDIFICIO_TO_LAVORO));

  /** Mantiene lavoro in abitanti sincronizzato con le assegnazioni agli edifici (es. Serra → Agricoltore). */
  useEffect(() => {
    setAbitanti((prev) => {
      const idToLavoroFromEdifici = new Map<number, string>();
      edifici.forEach((edificio) => {
        const job = EDIFICIO_TO_LAVORO[edificio.id];
        if (!job) return;
        (edificio.abitantiAssegnati ?? []).forEach((id) => idToLavoroFromEdifici.set(id, job));
      });
      let changed = false;
      const next = prev.map((a) => {
        const jobFromEdificio = idToLavoroFromEdifici.get(a.id);
        if (jobFromEdificio) {
          if (a.lavoro === jobFromEdificio) return a;
          changed = true;
          return { ...a, lavoro: jobFromEdificio };
        }
        if (LAVORI_DA_EDIFICIO.has(a.lavoro)) {
          changed = true;
          return { ...a, lavoro: "Disoccupato" };
        }
        return a;
      });
      return changed ? next : prev;
    });
  }, [edifici]);

  const assegnaAbitanteAEdificio = useCallback((abitanteId: number, edificioId: number) => {
    setEdifici((prevEdifici) =>
      prevEdifici.map((edificio) => {
        if (edificio.id === edificioId) {
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
    const lavoroAssociato = EDIFICIO_TO_LAVORO[edificioId];
    if (lavoroAssociato) {
      setAbitanti((prev) =>
        prev.map((a) => (a.id === abitanteId ? { ...a, lavoro: lavoroAssociato } : a))
      );
    }
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
    if (EDIFICIO_TO_LAVORO[edificioId]) {
      setAbitanti((prev) =>
        prev.map((a) => (a.id === abitanteId ? { ...a, lavoro: "Disoccupato" } : a))
      );
    }
  }, []);

  const setStipendioEdificio = useCallback((edificioId: number, stipendioPerLavoratore: number) => {
    const value = Math.max(0, Math.floor(stipendioPerLavoratore));
    setEdifici((prev) =>
      prev.map((e) => (e.id === edificioId ? { ...e, stipendioPerLavoratore: value } : e))
    );
  }, []);

  /** Aggiunge al Campo di Lavoro tutti gli abitanti che soddisfano i filtri (Personalità, Razza, Religione).
   * Il loro "lavoro" diventa "Prigioniero". Li rimuove da eventuali altri edifici. */
  const aggiungiAlCampoDiLavoroTuttiQuelliChe = useCallback(
    (filtro: { personalità?: string; razza?: string; religione?: string }) => {
      const campoLavoro = edifici.find((e) => e.nome === "Campo di Lavoro");
      if (!campoLavoro || campoLavoro.stato !== "Operativo") return;

      let candidati = abitanti.filter((a) => {
        if (filtro.personalità != null && filtro.personalità !== "" && a.personalità !== filtro.personalità)
          return false;
        const razza = a.razza ?? "Umano";
        if (filtro.razza != null && filtro.razza !== "" && razza !== filtro.razza) return false;
        if (filtro.religione != null && filtro.religione !== "" && a.religione !== filtro.religione)
          return false;
        return true;
      });

      const giàAssegnati = new Set(campoLavoro.abitantiAssegnati ?? []);
      candidati = candidati.filter((a) => !giàAssegnati.has(a.id));
      const postiLiberi = Math.max(0, campoLavoro.capacità - (campoLavoro.abitantiAssegnati?.length ?? 0));
      const idsToAdd = candidati.slice(0, postiLiberi).map((a) => a.id);
      if (idsToAdd.length === 0) return;

      setAbitanti((prev) =>
        prev.map((a) => (idsToAdd.includes(a.id) ? { ...a, lavoro: "Prigioniero" } : a))
      );
      setEdifici((prev) =>
        prev.map((e) => {
          if (e.nome === "Campo di Lavoro") {
            const nuovi = [...(e.abitantiAssegnati ?? []), ...idsToAdd];
            return { ...e, abitantiAssegnati: nuovi, occupazione: nuovi.length };
          }
          const nuoviAssegnati = (e.abitantiAssegnati ?? []).filter((id) => !idsToAdd.includes(id));
          return { ...e, abitantiAssegnati: nuoviAssegnati, occupazione: nuoviAssegnati.length };
        })
      );
    },
    [abitanti, edifici]
  );

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

  const setNomeAbitante = useCallback((abitanteId: number, nuovoNome: string) => {
    const nome = (nuovoNome ?? "").trim();
    if (!nome) return;
    setAbitanti((prev) =>
      prev.map((a) => (a.id === abitanteId ? { ...a, nome } : a))
    );
  }, []);

  const setAbitanteIncinta = useCallback((abitanteId: number, incinta: boolean) => {
    setAbitanti((prev) =>
      prev.map((a) => (a.id === abitanteId ? { ...a, incinta } : a))
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
                  // Traccia totale Cibo per bonus Ministero Agricoltura (applicato dopo il loop)
                  variazioni["__ciboProdotto"] = (variazioni["__ciboProdotto"] || 0) + produzioneTotale;
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

    // Calcola variazioni per i crediti: stipendio per lavoratore × numero lavoratori (niente costo fisso edifici)
    const totaleRedditi = abitanti.reduce((sum, a) => sum + a.reddito, 0);
    const totaleSpese = abitanti.reduce((sum, a) => sum + a.spese, 0);
    const totaleStipendiEdifici = edifici
      .filter((e) => e.stato === "Operativo")
      .reduce(
        (sum, e) =>
          sum + (e.stipendioPerLavoratore ?? 0) * (e.abitantiAssegnati?.length ?? 0),
        0
      );

    risorse.forEach((r) => {
      if (r.nome === "Crediti") {
        variazioni[r.nome] = totaleRedditi - totaleSpese - totaleStipendiEdifici;
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
          nome: generaNomeAlieno(razzaNativi),
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
          crediti: 800 + Math.floor(Math.random() * 401),
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
      const idsBonus = new Set<number>([criminale.id, ...(criminale.amici ?? []).map((x) => x.id)]);
      const idsMalus = new Set<number>((criminale.rivali ?? []).map((x) => x.id));
      return prev.map((a) => {
        let lealtà = a.lealtà;
        if (idsBonus.has(a.id)) lealtà = Math.min(100, Math.round(a.lealtà * 1.1));
        if (idsMalus.has(a.id)) lealtà = Math.max(0, Math.round(a.lealtà * 0.9));
        const reati = a.id === abitanteId ? [] : a.reati;
        return { ...a, lealtà, reati: reati ?? a.reati };
      });
    });
  }, []);

  // Tribunale: condanna a morte (solo se pena di morte attiva) → rimuove l'abitante dalla colonia e da tutti gli edifici
  const condannaAMorte = useCallback((abitanteId: number) => {
    setAbitanti((prev) => prev.filter((a) => a.id !== abitanteId));
    setEdifici((prev) =>
      prev.map((e) => {
        const nuovi = (e.abitantiAssegnati ?? []).filter((id) => id !== abitanteId);
        return nuovi.length !== (e.abitantiAssegnati?.length ?? 0)
          ? { ...e, abitantiAssegnati: nuovi, occupazione: nuovi.length }
          : e;
      })
    );
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

    // +1 se Ius primae noctis è attivo
    if (iusPrimaeNoctisAttivo) {
      punteggio += 1;
    }
    
    // Limita tra 1 e 10
    return Math.min(Math.max(punteggio, 1), 10);
  }, [abitanti, penaDiMorteAttiva, razzaCampoLavoro, razzaCampoSterminio, etaMinimaLavoro, divietoEspatrioAttivo, iusPrimaeNoctisAttivo]);

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
    iusPrimaeNoctisAttivo,
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
    setIusPrimaeNoctisAttivo,
    setTipologieFamigliaAccettate,
    setAbitanteIncinta,
    calcolaFelicitàModificata,
    avanzaMese,
    assegnaAbitanteAEdificio,
    rimuoviAbitanteDaEdificio,
    setStipendioEdificio,
    aggiungiAlCampoDiLavoroTuttiQuelliChe,
    nominaMinistro,
    rimuoviMinistro,
    setNomeAbitante,
    calcolaProduzioneConsumo,
    accettaImmigrante,
    rifiutaImmigrante,
    ordiniMercato,
    aggiungiOrdineMercato,
    rimuoviOrdineMercato,
    calcolaDeltaOrdiniMercato,
    graziaCriminale,
    condannaAMorte,
    nativiNonIntegrati,
    pendingAssimilazione,
    accettaAssimilazione,
    rifiutaAssimilazione,
    pendingMatrimonio,
    confermaMatrimonio,
    rifiutaMatrimonio,
    eventiInCorso,
    eventiCatalogo: EVENTI_CATALOGO,
    alertInizioPartita,
    chiudiAlertInizioPartita,
    messaggioEmigrazione,
    chiudiMessaggioEmigrazione
  };
}
