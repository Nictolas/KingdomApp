import { useState, useCallback, useEffect, useRef } from "react";
import { Alert } from "react-native";
import type { Abitante, Risorsa, Edificio, OrdineMercato, EventoInCorso, Razza } from "../types";
import { risorseData, edificiData, pianetiData } from "../kingdomData";
import { runAvanzaMese } from "../game/avanzaMese";
import { EVENTI_CATALOGO } from "../game/eventi/index";
import { generaColoniaIniziale } from "../game/generazionePartita";
import { calcolaPunteggioSanzioni as calcolaPunteggioSanzioniPuro } from "../game/sanzioni";
import {
  aggiungiOrdineMercatoPuro,
  calcolaDeltaOrdiniMercatoPuro
} from "../game/mercato";
import { graziaCriminalePuro, condannaAMortePuro } from "../game/tribunale";
import { generaAssimilati } from "../game/assimilazione";
import { calcolaProduzioneConsumoPuro } from "../game/produzioneConsumo";
import { calcolaFelicitàModificataPuro } from "../game/felicita";
import { generaImmigratiProposti } from "../game/immigrazione";
import { getLavoroPerEdificio, normalizzaLavoroEAgricoltura } from "../game/edificiLavoro";
import { getCastaAbitante } from "../game/casta";
import {
  PREZZO_SCHIAVO_DEFAULT,
  trasferisciProprietaSchiavoPuro,
  uccidiSchiavoPuro,
  puoEssereAssegnatoForzatamente
} from "../game/schiavituCommercio";
import { syncResidenzeBaraccaSenzatetto } from "../game/avanzaMese";
import { normalizzaInventariAbitanti } from "../game/consumoCiboInventario";
import {
  creaInventarioGiocatoreIniziale,
  normalizzaInventarioGiocatore,
  normalizzaInventarioMensa,
  type VoceInventario
} from "../game/inventario";
import { serviPastoMensaTransaction, trasferisciCiboGiocatoreAMensaPuro } from "../game/mensaPubblica";
import {
  getGiornoGiocoSnapshot,
  subscribeGiornoGioco
} from "../game/orologioGiocoSession";

const statoIniziale = generaColoniaIniziale();

export function useGameState() {
  const [abitanti, setAbitanti] = useState<Abitante[]>(statoIniziale.abitanti);
  const [razzaNativi] = useState<Razza>(statoIniziale.razzaNativi);
  const [inventarioGiocatore, setInventarioGiocatore] = useState<VoceInventario[]>(() =>
    creaInventarioGiocatoreIniziale()
  );
  const [inventarioMensaByEdificioId, setInventarioMensaByEdificioId] = useState<
    Record<number, VoceInventario[]>
  >({});
  const inventarioGiocatoreRef = useRef(inventarioGiocatore);
  const inventarioMensaRef = useRef(inventarioMensaByEdificioId);
  inventarioGiocatoreRef.current = inventarioGiocatore;
  inventarioMensaRef.current = inventarioMensaByEdificioId;
  const [risorse, setRisorse] = useState<Risorsa[]>(risorseData);
  const [edifici, setEdifici] = useState<Edificio[]>(() => {
    const tuttiId = statoIniziale.abitanti.map((a) => a.id);
    const baraccaIds = statoIniziale.abitanti.filter((a) => a.fazioni?.includes("Senzatetto")).map((a) => a.id);
    /** A inizio partita tutti (tranne Senzatetto in Baracca) stanno nelle Capanne; Dormitorio vuoto. */
    const dormitorioIds: number[] = [];
    const agricoltore = statoIniziale.abitanti.find((a) => a.lavoro === "Agricoltore");
    const serraIds = agricoltore ? [agricoltore.id] : [];
    const prigionieriIds = statoIniziale.abitanti.filter((a) => a.lavoro === "Prigioniero").map((a) => a.id);
    const capannaIds = tuttiId.filter((id) => !baraccaIds.includes(id));
    return edificiData.map((e) => {
      if (e.id === 4) return { ...e, abitantiAssegnati: baraccaIds, occupazione: baraccaIds.length };
      if (e.id === 14) return { ...e, abitantiAssegnati: dormitorioIds, occupazione: dormitorioIds.length };
      if (e.id === 2) return { ...e, abitantiAssegnati: serraIds, occupazione: serraIds.length };
      if (e.id === 21) return { ...e, abitantiAssegnati: [], occupazione: 0 };
      if (e.id === 9) return { ...e, abitantiAssegnati: prigionieriIds, occupazione: prigionieriIds.length };
      if (e.id === 20) return { ...e, abitantiAssegnati: capannaIds, occupazione: capannaIds.length };
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
  /** Righe appendici al Diario (avvisi rischio Guerra Civile, ecc.). */
  const [diarioRighe, setDiarioRighe] = useState<string[]>([]);

  /** Soddisfazione 1-100 per fazioni tracciate (Rivoluzionari, Sicurezza). Partono a 80. */
  const [soddisfazioneFazioni, setSoddisfazioneFazioni] = useState<Record<string, number>>(() => ({
    Rivoluzionari: 80,
    Sicurezza: 80
  }));
  const modificaSoddisfazioneFazione = useCallback((fazione: string, delta: number) => {
    setSoddisfazioneFazioni((prev) => ({
      ...prev,
      [fazione]: Math.max(1, Math.min(100, (prev[fazione] ?? 80) + delta))
    }));
  }, []);

  // Baracca = tutti e solo i Senzatetto: sincronizza quando cambiano gli abitanti (es. nuovo immigrato approvato)
  useEffect(() => {
    setEdifici((prev) => syncResidenzeBaraccaSenzatetto(prev, abitanti));
  }, [abitanti]);

  /** Inventario iniziale + consumo giornaliero di un oggetto Cibo a ogni nuovo giorno di gioco. */
  useEffect(() => {
    setAbitanti((prev) => normalizzaInventariAbitanti(prev, getGiornoGiocoSnapshot()));
    setInventarioGiocatore((prev) => normalizzaInventarioGiocatore(prev));
    const unsub = subscribeGiornoGioco(() => {
      setAbitanti((prev) => normalizzaInventariAbitanti(prev, getGiornoGiocoSnapshot()));
    });
    return unsub;
  }, []);

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

  // Età pensionabile: oltre questa età l'abitante diventa "Pensionato" e riceve assegno mensile; non lavora
  const [etaPensionabile, setEtaPensionabile] = useState(65);
  const [assegnoPensionati, setAssegnoPensionati] = useState(200);
  
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
    matrimonioUmanoRobot: boolean;
    matrimonioIntercasta: boolean;
  }>({
    tradizionale: true,
    interrazziale: true,
    arcobaleno: true,
    monogenitoriale: true,
    matrimonioUmanoRobot: false,
    matrimonioIntercasta: false
  });

  // Reddito di cittadinanza: importo mensile dato a disoccupati non schiavi
  const [redditoCittadinanza, setRedditoCittadinanza] = useState(0);

  // Modalità sistema sanitario: influenza i costi dell'Ospedale
  const [modalitaSanita, setModalitaSanita] = useState<"privata" | "pubblica">("privata");

  /** Prezzo mensile (crediti) impostato dall'utente per ogni tipo di residenza. Default dal catalogo se non impostato. */
  const [prezzoResidenze, setPrezzoResidenzeState] = useState<Record<string, number>>({});
  const setPrezzoResidenza = useCallback((nomeResidenza: string, prezzo: number) => {
    if (nomeResidenza === "Baracca" || nomeResidenza === "Capanna") return; // Costo 0 fisso, non modificabile
    const value = Math.max(0, Math.floor(prezzo));
    setPrezzoResidenzeState((prev) => ({ ...prev, [nomeResidenza]: value }));
  }, []);

  // Genera nuovi abitanti proposti per immigrazione (logica in src/game/immigrazione)
  const generaNuoviAbitantiProposti = useCallback(() => {
    setNextId((prevId) => {
      const { nuoviAbitanti, nextIdDopo } = generaImmigratiProposti(prevId);
      setAbitantiProposti(nuoviAbitanti);
      return nextIdDopo;
    });
  }, []);

  // Felicità modificata per politica religiosa e legge droghe (logica in src/game/felicita)
  const calcolaFelicitàModificata = useCallback(
    (abitante: Abitante): number =>
      calcolaFelicitàModificataPuro(abitante, {
        politicaReligiosa,
        religioneDiStato,
        leggeDroghe
      }),
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
      calcolaFelicitàModificata,
      politicaNascite,
      nextId,
      etaPensionabile,
      assegnoPensionati,
      soddisfazioneFazioni,
      prezzoResidenze,
      redditoCittadinanza,
      modalitaSanita,
      tipologieFamigliaAccettate
    });

    setNativiNonIntegrati((prev) => prev + result.deltaNativiNonIntegrati);
    if (result.pendingAssimilazione != null) setPendingAssimilazione(result.pendingAssimilazione);
    if (result.pendingMatrimonio != null) setPendingMatrimonio(result.pendingMatrimonio);
    if (result.newIdNascita != null) setNextId(result.newIdNascita + 1);
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
    if (result.pendingGravidanza) {
      Alert.alert("Gravidanza", `${result.pendingGravidanza.nome} è incinta.`);
    }
    if (result.messaggioNascita) {
      Alert.alert("Nascita", result.messaggioNascita);
    }
    if (result.avvisoDiario) {
      setDiarioRighe((prev) => [...prev, result.avvisoDiario!]);
    }
  }, [abitanti, edifici, risorse, ordiniMercato, eventiInCorso, punteggioSanzioni, mese, anno, generaNuoviAbitantiProposti, divietoEspatrioAttivo, calcolaFelicitàModificata, politicaNascite, nextId, etaPensionabile, assegnoPensionati, soddisfazioneFazioni, prezzoResidenze, redditoCittadinanza, modalitaSanita, tipologieFamigliaAccettate]);

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
        setAbitanti((prev) =>
          prev.map((a) =>
            a.id === abitanteId
              ? { ...a, incinta: true, gravidanzaIniziataMese: mese, gravidanzaIniziataAnno: anno }
              : a
          )
        );
        Alert.alert("Gravidanza", `${scelto.nome} è incinta.`);
      }
      setPendingMatrimonio(null);
    },
    [abitanti, mese, anno]
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

  /**
   * Ogni «Agricoltore» finisce in una Serra operativa con posto libero; poi il lavoro segue le assegnazioni.
   * Eseguito in un solo passaggio per evitare stati intermedi (es. immigrato Agricoltore demotato a Disoccupato).
   */
  useEffect(() => {
    const { abitanti: nextA, edifici: nextE } = normalizzaLavoroEAgricoltura(abitanti, edifici);
    if (nextA !== abitanti) setAbitanti(nextA);
    if (nextE !== edifici) setEdifici(nextE);
  }, [abitanti, edifici]);

  const assegnaAbitanteAEdificio = useCallback((abitanteId: number, edificioId: number) => {
    const abitante = abitanti.find((a) => a.id === abitanteId);
    if (abitante?.lavoro === "Pensionato") return;
    const edificioCorrente = edifici.find((e) => e.id === edificioId);
    if (!edificioCorrente) return;
    if (
      edificioCorrente.abitantiAssegnati.includes(abitanteId) ||
      edificioCorrente.abitantiAssegnati.length >= edificioCorrente.capacità ||
      edificioCorrente.stato !== "Operativo"
    )
      return;

    setEdifici((prevEdifici) =>
      prevEdifici.map((edificio) => {
        if (edificio.id === edificioId) {
          return {
            ...edificio,
            abitantiAssegnati: [...edificio.abitantiAssegnati, abitanteId],
            occupazione: edificio.abitantiAssegnati.length + 1
          };
        }
        return edificio;
      })
    );
    const lavoroAssociato = getLavoroPerEdificio(edificioCorrente);
    if (lavoroAssociato) {
      setAbitanti((prev) =>
        prev.map((a) => (a.id === abitanteId ? { ...a, lavoro: lavoroAssociato } : a))
      );
    }
  }, [abitanti, edifici]);

  const rimuoviAbitanteDaEdificio = useCallback((abitanteId: number, edificioId: number) => {
    const edificioCorrente = edifici.find((e) => e.id === edificioId);
    const avevaLavoroEdificio = edificioCorrente ? getLavoroPerEdificio(edificioCorrente) : undefined;
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
    if (avevaLavoroEdificio) {
      setAbitanti((prev) =>
        prev.map((a) => (a.id === abitanteId ? { ...a, lavoro: "Disoccupato" } : a))
      );
    }
  }, [edifici]);

  const setStipendioEdificio = useCallback((edificioId: number, stipendioPerLavoratore: number) => {
    const value = Math.max(0, Math.floor(stipendioPerLavoratore));
    setEdifici((prev) =>
      prev.map((e) => (e.id === edificioId ? { ...e, stipendioPerLavoratore: value } : e))
    );
  }, []);

  /** Crea un nuovo edificio nel modello di gioco a partire da una riga del catalogo (nuovo id univoco). */
  const aggiungiEdificioDaTemplate = useCallback((templateId: number): number | null => {
    const template = edificiData.find((x) => x.id === templateId);
    if (!template) return null;
    let createdId: number | null = null;
    setEdifici((prev) => {
      const newId = Math.max(0, ...prev.map((x) => x.id)) + 1;
      createdId = newId;
      const nuovo: Edificio = {
        ...template,
        id: newId,
        abitantiAssegnati: [],
        occupazione: 0,
        stato: "Operativo"
      };
      return [...prev, nuovo];
    });
    return createdId;
  }, []);

  const rimuoviEdificioPerId = useCallback((id: number) => {
    setEdifici((prev) => prev.filter((x) => x.id !== id));
  }, []);

  /** Aggiunge al Campo di Lavoro tutti gli abitanti che soddisfano i filtri (Personalità, Razza, Religione).
   * Il loro "lavoro" diventa "Prigioniero". Li rimuove da eventuali altri edifici. */
  const aggiungiAlCampoDiLavoroTuttiQuelliChe = useCallback(
    (filtro: { personalità?: string; razza?: string; religione?: string }) => {
      const campoLavoro = edifici.find((e) => e.nome === "Campo di Lavoro");
      if (!campoLavoro || campoLavoro.stato !== "Operativo") return;

      let candidati = abitanti.filter((a) => {
        if (!puoEssereAssegnatoForzatamente(a)) return false;
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

  const serviPastoMensaAbitante = useCallback((abitanteId: number, edificioId: number) => {
    const mensaInv = normalizzaInventarioMensa(inventarioMensaRef.current[edificioId]);
    const giorno = getGiornoGiocoSnapshot();
    setAbitanti((prev) =>
      prev.map((a) => {
        if (a.id !== abitanteId) return a;
        const { abitante, inventarioMensa } = serviPastoMensaTransaction(a, mensaInv, giorno);
        setInventarioMensaByEdificioId((prevM) => ({
          ...prevM,
          [edificioId]: inventarioMensa
        }));
        return abitante;
      })
    );
  }, []);

  const trasferisciCiboGiocatoreAMensa = useCallback(
    (edificioId: number, itemId: string, quantità: number): boolean => {
      const result = trasferisciCiboGiocatoreAMensaPuro(
        inventarioGiocatoreRef.current,
        inventarioMensaRef.current[edificioId],
        itemId,
        quantità
      );
      if (!result) return false;
      setInventarioGiocatore(result.inventarioGiocatore);
      setInventarioMensaByEdificioId((prev) => ({
        ...prev,
        [edificioId]: result.inventarioMensa
      }));
      return true;
    },
    []
  );

  // Calcola produzione/consumo mensile per ogni risorsa (usa funzione pura in src/game)
  const calcolaProduzioneConsumo = useCallback(
    () =>
      calcolaProduzioneConsumoPuro({
        abitanti,
        edifici,
        risorse,
        assegnoPensionati
      }),
    [abitanti, edifici, risorse, assegnoPensionati]
  );

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
    const { nuoviAbitanti, nextIdDopo } = generaAssimilati({
      razzaNativi,
      count,
      nextId,
      emojiNativo
    });
    if (nuoviAbitanti.length > 0) {
      setAbitanti((prev) => [...prev, ...nuoviAbitanti]);
      setNextId(nextIdDopo);
    }
  }, [pendingAssimilazione, razzaNativi, nextId]);

  const rifiutaAssimilazione = useCallback(() => {
    setPendingAssimilazione(null);
  }, []);

  // Tribunale: grazia un criminale (logica pura in src/game/tribunale); se Ex Governatore → Rivoluzionari -20.
  const graziaCriminale = useCallback(
    (abitanteId: number) => {
      const criminale = abitanti.find((a) => a.id === abitanteId);
      if (criminale?.reati?.includes("Ex Governatore")) {
        modificaSoddisfazioneFazione("Rivoluzionari", -20);
      }
      setAbitanti((prev) => graziaCriminalePuro(prev, abitanteId));
    },
    [abitanti, modificaSoddisfazioneFazione]
  );

  // Tribunale: condanna a morte → rimuove l'abitante da colonia e edifici (logica pura in src/game/tribunale).
  const condannaAMorte = useCallback(
    (abitanteId: number) => {
      const { nuoviAbitanti, nuoviEdifici } = condannaAMortePuro(
        abitanti,
        edifici,
        abitanteId
      );
      setAbitanti(nuoviAbitanti);
      setEdifici(nuoviEdifici);
    },
    [abitanti, edifici]
  );

  const assegnaServoDellaGlebaAEdificio = useCallback(
    (abitanteId: number, edificioId: number) => {
      const abitante = abitanti.find((a) => a.id === abitanteId);
      if (!abitante || getCastaAbitante(abitante) !== "Servo della gleba") return;
      assegnaAbitanteAEdificio(abitanteId, edificioId);
    },
    [abitanti, assegnaAbitanteAEdificio]
  );

  const trasferisciProprietaSchiavo = useCallback(
    (schiavoId: number, nuovoProprietarioId: number | null, prezzo: number = PREZZO_SCHIAVO_DEFAULT) => {
      const result = trasferisciProprietaSchiavoPuro({
        abitanti,
        risorse,
        schiavoId,
        nuovoProprietarioId,
        prezzo
      });
      if (!result.ok) return false;
      setAbitanti(result.abitanti);
      setRisorse(result.risorse);
      return true;
    },
    [abitanti, risorse]
  );

  const uccidiSchiavo = useCallback(
    (uccisoreId: number | null, schiavoId: number) => {
      const result = uccidiSchiavoPuro({ abitanti, edifici, uccisoreId, schiavoId });
      if (!result.ok) return false;
      setAbitanti(result.abitanti);
      setEdifici(result.edifici);
      return true;
    },
    [abitanti, edifici]
  );

  // Mercato: ordini di acquisto/vendita; si eseguono solo al cambio mese (Skip Mese)
  const aggiungiOrdineMercato = useCallback(
    (tipo: "compra" | "vendi", risorsaId: number, quantità: number, prezzoUnitario: number): boolean => {
      const result = aggiungiOrdineMercatoPuro({
        tipo,
        risorsaId,
        quantità,
        prezzoUnitario,
        ordiniCorrenti: ordiniMercato,
        risorse
      });
      if (!result.success) return false;
      setOrdiniMercato((prev) => [...prev, result.nuovoOrdine]);
      return true;
    },
    [risorse, ordiniMercato]
  );

  const rimuoviOrdineMercato = useCallback((ordineId: number) => {
    setOrdiniMercato((prev) => prev.filter((o) => o.id !== ordineId));
  }, []);

  // Delta risorse dall'anteprima ordini (per mostrare in Home l'effetto al cambio mese)
  const calcolaDeltaOrdiniMercato = useCallback((): Record<string, number> => {
    return calcolaDeltaOrdiniMercatoPuro(ordiniMercato, risorse);
  }, [ordiniMercato, risorse]);

  // Calcola il punteggio sanzioni basato sulle leggi attive (usa funzione pura in src/game)
  const calcolaPunteggioSanzioni = useCallback(
    () =>
      calcolaPunteggioSanzioniPuro({
        abitanti,
        penaDiMorteAttiva,
        razzaCampoLavoro,
        razzaCampoSterminio,
        etaMinimaLavoro,
        etaPensionabile,
        divietoEspatrioAttivo,
        iusPrimaeNoctisAttivo
      }),
    [
      abitanti,
      penaDiMorteAttiva,
      razzaCampoLavoro,
      razzaCampoSterminio,
      etaMinimaLavoro,
      etaPensionabile,
      divietoEspatrioAttivo,
      iusPrimaeNoctisAttivo
    ]
  );

  // Aggiorna il punteggio quando cambiano le condizioni
  useEffect(() => {
    const nuovoPunteggio = calcolaPunteggioSanzioni();
    setPunteggioSanzioni(nuovoPunteggio);
  }, [calcolaPunteggioSanzioni]);

  return {
    abitanti,
    inventarioGiocatore,
    inventarioMensaByEdificioId,
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
    etaPensionabile,
    assegnoPensionati,
    leggeDroghe,
    divietoEspatrioAttivo,
    iusPrimaeNoctisAttivo,
    tipologieFamigliaAccettate,
    modalitaSanita,
    redditoCittadinanza,
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
    setEtaPensionabile,
    setAssegnoPensionati,
    setLeggeDroghe,
    setDivietoEspatrioAttivo,
    setIusPrimaeNoctisAttivo,
    setTipologieFamigliaAccettate,
    setRedditoCittadinanza,
    setModalitaSanita,
    setAbitanteIncinta,
    serviPastoMensaAbitante,
    trasferisciCiboGiocatoreAMensa,
    calcolaFelicitàModificata,
    avanzaMese,
    assegnaAbitanteAEdificio,
    rimuoviAbitanteDaEdificio,
    setStipendioEdificio,
    aggiungiEdificioDaTemplate,
    rimuoviEdificioPerId,
    prezzoResidenze,
    setPrezzoResidenza,
    aggiungiAlCampoDiLavoroTuttiQuelliChe,
    assegnaServoDellaGlebaAEdificio,
    trasferisciProprietaSchiavo,
    uccidiSchiavo,
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
    soddisfazioneFazioni,
    modificaSoddisfazioneFazione,
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
    chiudiMessaggioEmigrazione,
    diarioRighe
  };
}
