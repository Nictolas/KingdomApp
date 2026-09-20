import { useState, useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { Alert } from "react-native";
import type { Abitante, Risorsa, Edificio, OrdineMercato, EventoInCorso, Razza } from "../types";
import { risorseData, edificiData, pianetiData } from "../kingdomData";
import { estraiCreditiLegacyDaRisorse } from "../data/risorseData";
import { OBIETTIVI_CATALOGO, obiettiviSbloccati } from "../data/obiettiviCatalogo";
import { runAvanzaMese } from "../game/avanzaMese";
import { EVENTI_CATALOGO } from "../game/eventi/index";
import { generaColoniaIniziale } from "../game/generazionePartita";
import {
  ID_GIOCATORE,
  LAVORO_GIOCATORE,
  ETA_GIOCATORE_INIZIALE
} from "../game/schiavituCommercio";
import type { DatiCreazioneGiocatore } from "../ui/CreazioneGiocatoreModal";
import { calcolaPunteggioSanzioni as calcolaPunteggioSanzioniPuro } from "../game/sanzioni";
import {
  aggiungiOrdineMercatoPuro,
  calcolaDeltaOrdiniMercatoPuro,
  calcolaDeltaTesoroOrdiniMercato
} from "../game/mercato";
import {
  avanzaCarcereResiduoPuro,
  condannaAlCampoDiLavoroPuro,
  condannaAMortePuro,
  graziaCriminalePuro,
  valutaSentenzaGiudice,
  type RisultatoGiudizio
} from "../game/tribunale";
import { PENA_REATI_INIZIALE, type PenaReatiConfig, type ReatoPunibile } from "../game/reati";
import { generaAssimilati } from "../game/assimilazione";
import { calcolaProduzioneConsumoPuro } from "../game/produzioneConsumo";
import { calcolaFelicitàModificataPuro } from "../game/felicita";
import { applicaTasseMensili, eseguiPrelievoForzoso } from "../game/tasse";
import { tasseSbloccate } from "../game/tasseSblocco";
import { applicaEsitoChiacchieraSuLista } from "../game/relazioneChiacchiera";
import { getEdificioAbitazione } from "../game/abitanteEdifici";
import { generaImmigratiProposti } from "../game/immigrazione";
import { getLavoroPerEdificio, autoAssegnaCittadiniDisoccupati, normalizzaLavoroEAgricoltura, edificioAccettaServiDellaGleba, isEdificioPubblicoConPostazioniLavoro, assumiCittadinoDisoccupatoInEdificio } from "../game/edificiLavoro";
import {
  consumaMaterialeEdile,
  edificioParteInCostruzione,
  haMaterialeEdileSufficiente
} from "../game/costruzioneEdifici";
import {
  creaMoneteGiocatoreIniziali,
  pagaStipendiEdificiPubblici
} from "../game/edificiPubblici";
import {
  ASSEGNO_PENSIONATI_DEFAULT,
  REDDITO_CITTADINANZA_DEFAULT,
  STIPENDIO_BASE_MONETE_MESE,
  TASSA_PATRIMONIO_PERCENTUALE_DEFAULT,
  IVA_PERCENTUALE_DEFAULT
} from "../game/economiaPrezzi";
import { getCastaAbitante } from "../game/casta";
import {
  PREZZO_SCHIAVO_DEFAULT,
  trasferisciProprietaSchiavoPuro,
  uccidiSchiavoPuro,
  puoEssereAssegnatoForzatamente
} from "../game/schiavituCommercio";
import { syncResidenzeBaraccaSenzatetto } from "../game/avanzaMese";
import { attivaEventoCarestia } from "../game/eventi/attivaCarestia";
import { normalizzaEAplicaPastiAbitanti } from "../game/pastoGiornaliero";
import {
  creaInventarioGiocatoreIniziale,
  normalizzaInventarioMensa,
  type VoceInventario
} from "../game/inventario";
import { serviPastoMensaTransaction, trasferisciCiboGiocatoreAMensaPuro } from "../game/mensaPubblica";
import {
  getGiornoGiocoSnapshot,
  getOrologioPersistableSnapshot,
  restoreOrologioGioco,
  setOrologioGiocoBloccatoDallaFase,
  subscribeGiornoGioco
} from "../game/orologioGiocoSession";
import {
  COLTURA_SERRA_DEFAULT,
  isColturaSerraValida,
  normalizzaColtureSerraSbloccate,
  tutteColtureSerraSbloccate
} from "../game/colturaSerra";
import {
  applicaProduzioneSerraInventarioGiocatore,
  calcolaProduzioneSerraPerPeriodo
} from "../game/produzioneSerra";
import {
  haLuogoCulto,
  TEMPLATE_ID_LUOGO_CULTO,
  trovaCapoReligiosoSenzaLuogo,
  type ReligioneConCulto
} from "../game/luogoCulto";
import { creaRichiestaLuogoCulto, type RichiestaInAttesa } from "../game/richieste";
import { provaCreaReligioneCustom, type ReligioneCustom } from "../game/fedeleCulto";
import { assicuraReligioneTempioChiese } from "../game/chiesa";
import { isSimulationRunning, type GamePhase } from "../game/gamePhase";
import type { GameMode } from "../game/gameMode";
import { sincronizzaCuginoNobileConRe } from "../game/cuginoNobileAvventura";
import { filtraEdificiInizialiPerModalita } from "../game/edificiInizialiModalita";
import type { PersistableGameState } from "../persistence/gameStateMapping";
import type { MappaRuntimeState } from "../game/mappaTypes";
import { setMappaSessione, getMappaSessione } from "../game/mappaSessione";
import { mappaHaPonteOperativo } from "../game/ponteMappa";
import { pulisciModificatoriScaduti } from "../game/soddisfazione";
import {
  indiceCalendarioGioco,
  indiceMeseDaGiornoGioco,
  offsetMesiPerCalendarioSalvato
} from "../game/calendarioGioco";

const statoIniziale = generaColoniaIniziale();
const capoReligiosoSoleIniziale =
  statoIniziale.abitanti.find((a) => a.lavoro === "Capo Religioso" && a.religione === "Culto del Sole")?.id ?? null;

function creaEdificiIniziali(abitantiIniziali: Abitante[], mode: GameMode = "creativa"): Edificio[] {
  const tuttiId = abitantiIniziali.map((a) => a.id);
  const baraccaIds = abitantiIniziali.filter((a) => a.fazioni?.includes("Senzatetto")).map((a) => a.id);
  const dormitorioIds: number[] = [];
  const agricoltore = abitantiIniziali.find((a) => a.lavoro === "Agricoltore");
  const serraIds = agricoltore ? [agricoltore.id] : [];
  const prigionieriIds = abitantiIniziali.filter((a) => a.lavoro === "Prigioniero").map((a) => a.id);
  const capannaIds = tuttiId.filter((id) => !baraccaIds.includes(id));
  return filtraEdificiInizialiPerModalita(edificiData, mode)
    .map((e) => {
      let next: Edificio = e;
      if (e.id === 4) next = { ...e, abitantiAssegnati: baraccaIds, occupazione: baraccaIds.length };
      else if (e.id === 14) next = { ...e, abitantiAssegnati: dormitorioIds, occupazione: dormitorioIds.length };
      else if (e.id === 2) next = { ...e, abitantiAssegnati: serraIds, occupazione: serraIds.length };
      else if (e.id === 21) next = { ...e, abitantiAssegnati: [], occupazione: 0 };
      else if (e.id === 9) next = { ...e, abitantiAssegnati: prigionieriIds, occupazione: prigionieriIds.length };
      else if (e.id === 20) next = { ...e, abitantiAssegnati: capannaIds, occupazione: capannaIds.length };
      // Attività iniziali con posti lavoro: stipendio base 1 moneta/giorno (30/mese).
      if (
        next.stipendioPerLavoratore == null &&
        isEdificioPubblicoConPostazioniLavoro({ ...next, stato: "Operativo" })
      ) {
        next = { ...next, stipendioPerLavoratore: STIPENDIO_BASE_MONETE_MESE };
      }
      return next;
    });
}

const edificiIniziali = creaEdificiIniziali(statoIniziale.abitanti);

function calcolaPendingRichiestaLuogoCulto(
  abitantiCorrenti: Abitante[],
  edificiCorrenti: Edificio[],
  capoSole: number | null,
  capoAlieni: number | null,
  richiesteInAttesa: RichiestaInAttesa[] = [],
  luoghiCultoRifiutati: ReligioneConCulto[] = []
): { id: number; nome: string; religione: ReligioneConCulto } | null {
  const capo = trovaCapoReligiosoSenzaLuogo(abitantiCorrenti, edificiCorrenti, undefined, {
    sole: capoSole,
    alieni: capoAlieni
  });
  if (!capo || (capo.religione !== "Culto del Sole" && capo.religione !== "Culto delle Ombre")) return null;
  const religione = capo.religione as ReligioneConCulto;
  if (richiesteInAttesa.some((r) => r.tipo === "luogo-culto" && r.religione === religione)) return null;
  if (luoghiCultoRifiutati.includes(religione)) return null;
  return { id: capo.id, nome: capo.nome, religione };
}

export function useGameState() {
  const [gameMode, setGameMode] = useState<GameMode>("avventura");
  const [obiettiviCompletati, setObiettiviCompletati] = useState<string[]>([]);
  const [coltureSerraSbloccate, setColtureSerraSbloccate] = useState<string[]>([COLTURA_SERRA_DEFAULT]);
  const [gamePhase, setGamePhase] = useState<GamePhase>("loading");
  const gamePhaseRef = useRef<GamePhase>(gamePhase);
  gamePhaseRef.current = gamePhase;
  const simulationEnabled = isSimulationRunning(gamePhase);
  const [abitanti, setAbitanti] = useState<Abitante[]>(statoIniziale.abitanti);
  const [razzaNativi, setRazzaNativi] = useState<Razza>(statoIniziale.razzaNativi);
  const [inventarioGiocatore, setInventarioGiocatore] = useState<VoceInventario[]>(() =>
    creaInventarioGiocatoreIniziale()
  );
  const [moneteGiocatore, setMoneteGiocatore] = useState(() => creaMoneteGiocatoreIniziali());
  const [inventarioMensaByEdificioId, setInventarioMensaByEdificioId] = useState<
    Record<number, VoceInventario[]>
  >({});
  const inventarioGiocatoreRef = useRef(inventarioGiocatore);
  const inventarioMensaRef = useRef(inventarioMensaByEdificioId);
  const moneteGiocatoreRef = useRef(moneteGiocatore);
  const abitantiRef = useRef(abitanti);
  inventarioGiocatoreRef.current = inventarioGiocatore;
  inventarioMensaRef.current = inventarioMensaByEdificioId;
  moneteGiocatoreRef.current = moneteGiocatore;
  abitantiRef.current = abitanti;
  const [risorse, setRisorse] = useState<Risorsa[]>(() => estraiCreditiLegacyDaRisorse(risorseData).risorse);
  const [edifici, setEdifici] = useState<Edificio[]>(edificiIniziali);
  const edificiRef = useRef(edifici);
  edificiRef.current = edifici;
  const ultimoGiornoProduzioneSerraRef = useRef(getGiornoGiocoSnapshot());
  const ultimoGiornoEconomiaPubblicaRef = useRef(getGiornoGiocoSnapshot());
  const ultimoGiornoPastiRef = useRef(0);
  const [mese, setMese] = useState(1);
  const [anno, setAnno] = useState(0);
  const giornoGioco = useSyncExternalStore(
    subscribeGiornoGioco,
    getGiornoGiocoSnapshot,
    getGiornoGiocoSnapshot
  );
  const offsetMesiOrologioRef = useRef(0);
  const meseRef = useRef(mese);
  const annoRef = useRef(anno);
  meseRef.current = mese;
  annoRef.current = anno;
  const [isLoading] = useState(false);
  const [abitantiProposti, setAbitantiProposti] = useState<Abitante[]>([]);
  const [nextId, setNextId] = useState(statoIniziale.abitanti.length + 100); // ID iniziale per nuovi abitanti
  const [ordiniMercato, setOrdiniMercato] = useState<OrdineMercato[]>([]);
  const [eventiInCorso, setEventiInCorso] = useState<EventoInCorso[]>([]);
  const eventiInCorsoRef = useRef(eventiInCorso);
  eventiInCorsoRef.current = eventiInCorso;
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
    if (!simulationEnabled) return;
    setEdifici((prev) => syncResidenzeBaraccaSenzatetto(prev, abitanti));
  }, [abitanti, simulationEnabled]);

  /** Inventario iniziale + pasti giornalieri (inventario, padrone, mensa). */
  useEffect(() => {
    const applicaPasti = () => {
      if (!isSimulationRunning(gamePhaseRef.current)) return;
      const giorno = getGiornoGiocoSnapshot();
      const ultimo = ultimoGiornoPastiRef.current;
      if (giorno <= ultimo) return;

      const result = normalizzaEAplicaPastiAbitanti(
        abitantiRef.current,
        edificiRef.current,
        inventarioMensaRef.current,
        giorno,
        ultimo
      );
      ultimoGiornoPastiRef.current = giorno;

      const abitantiConModificatoriPuliti = result.abitanti.map((a) =>
        pulisciModificatoriScaduti(a, giorno, meseRef.current, annoRef.current)
      );
      setAbitanti(abitantiConModificatoriPuliti);
      setInventarioMensaByEdificioId(result.inventarioMensaByEdificioId);
      if (result.carestiaMensa) {
        setEventiInCorso((prev) => attivaEventoCarestia(prev, meseRef.current, annoRef.current));
      }
    };

    applicaPasti();
    const unsub = subscribeGiornoGioco(applicaPasti);
    return unsub;
  }, []);

  /** Produzione Serra: 1 unità/giorno per ogni Serra operativa → inventario cibo giocatore. */
  useEffect(() => {
    const applicaProduzioneSerra = () => {
      if (!isSimulationRunning(gamePhaseRef.current)) return;
      const giorno = getGiornoGiocoSnapshot();
      const ultimo = ultimoGiornoProduzioneSerraRef.current;
      if (giorno <= ultimo) return;
      const giorni = giorno - ultimo;
      ultimoGiornoProduzioneSerraRef.current = giorno;
      const produzione = calcolaProduzioneSerraPerPeriodo(edificiRef.current, giorni);
      if (produzione.size === 0) return;
      setInventarioGiocatore((prev) =>
        applicaProduzioneSerraInventarioGiocatore(prev, produzione)
      );
    };
    const unsub = subscribeGiornoGioco(applicaProduzioneSerra);
    return unsub;
  }, []);

  /** All’avvio: i cittadini disoccupati prendono subito i posti vacanti (Bar, Serra, …). */
  useEffect(() => {
    if (!simulationEnabled) return;
    let edificiNext = autoAssegnaCittadiniDisoccupati(abitantiRef.current, edificiRef.current);
    const norm = normalizzaLavoroEAgricoltura(abitantiRef.current, edificiNext);
    setEdifici(norm.edifici);
    if (norm.abitanti !== abitantiRef.current) setAbitanti(norm.abitanti);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo bootstrap partita
  }, [simulationEnabled]);

  /** Cittadini disoccupati cercano lavoro; stipendi edifici pubblici dal tesoro del giocatore. */
  useEffect(() => {
    const applicaEconomiaPubblica = () => {
      if (!isSimulationRunning(gamePhaseRef.current)) return;
      const giorno = getGiornoGiocoSnapshot();
      const ultimo = ultimoGiornoEconomiaPubblicaRef.current;
      if (giorno <= ultimo) return;
      const giorni = giorno - ultimo;
      ultimoGiornoEconomiaPubblicaRef.current = giorno;

      let edificiNext = edificiRef.current;
      let abitantiNext = abitantiRef.current;
      for (let g = 0; g < giorni; g++) {
        edificiNext = autoAssegnaCittadiniDisoccupati(abitantiNext, edificiNext);
        const norm = normalizzaLavoroEAgricoltura(abitantiNext, edificiNext);
        edificiNext = norm.edifici;
        abitantiNext = norm.abitanti;
      }

      const pagato = pagaStipendiEdificiPubblici(
        moneteGiocatoreRef.current,
        abitantiNext,
        edificiNext,
        giorni
      );

      setMoneteGiocatore(pagato.moneteGiocatore);
      setAbitanti(pagato.abitanti);
      setEdifici(edificiNext);
    };
    const unsub = subscribeGiornoGioco(applicaEconomiaPubblica);
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
  const [tassaPatrimonioPercentuale, setTassaPatrimonioPercentuale] = useState(
    TASSA_PATRIMONIO_PERCENTUALE_DEFAULT
  );
  const [ivaPercentuale, setIvaPercentuale] = useState(IVA_PERCENTUALE_DEFAULT);
  
  // Configurazione politica sulle nascite
  const [politicaNascite, setPoliticaNascite] = useState<"figlio-unico" | "incentivi" | "nessuna">("nessuna");
  
  // Sistema sanzioni (punteggio da 1 a 10)
  const [punteggioSanzioni, setPunteggioSanzioni] = useState(1);
  const [penaDiMorteAttiva, setPenaDiMorteAttiva] = useState(true);
  const [penaReati, setPenaReati] = useState<PenaReatiConfig>(PENA_REATI_INIZIALE);
  
  // Configurazione politica religiosa
  const [politicaReligiosa, setPoliticaReligiosa] = useState<"ateismo-stato" | "religione-stato" | "liberta-culto">("liberta-culto");
  const [religioneDiStato, setReligioneDiStato] = useState<
    "Ateo" | "Deista" | "Agnostico" | "Culto del Sole" | "Culto delle Ombre" | string | null
  >(null);
  const [religioniCustom, setReligioniCustom] = useState<ReligioneCustom[]>([]);
  
  // Capo religioso e fedeli per ogni culto
  const [capoReligiosoSole, setCapoReligiosoSole] = useState<number | null>(capoReligiosoSoleIniziale);
  const [capoReligiosoAlieni, setCapoReligiosoAlieni] = useState<number | null>(null);
  const [pendingRichiestaLuogoCulto, setPendingRichiestaLuogoCulto] = useState<{
    id: number;
    nome: string;
    religione: ReligioneConCulto;
  } | null>(null);
  const [luoghiCultoPendentiMappa, setLuoghiCultoPendentiMappa] = useState<
    { religione: ReligioneConCulto; edificioGlobaleId: number }[]
  >([]);
  const [richiesteInAttesa, setRichiesteInAttesa] = useState<RichiestaInAttesa[]>([]);
  const [luoghiCultoRifiutati, setLuoghiCultoRifiutati] = useState<ReligioneConCulto[]>([]);

  // Sincronizza lavoro «Capo Religioso» con la nomina nei culti.
  useEffect(() => {
    if (!simulationEnabled) return;
    setAbitanti((prev) =>
      prev.map((a) => {
        if (capoReligiosoSole != null && a.id === capoReligiosoSole) {
          return { ...a, lavoro: "Capo Religioso", religione: "Culto del Sole" as const };
        }
        if (capoReligiosoAlieni != null && a.id === capoReligiosoAlieni) {
          return { ...a, lavoro: "Capo Religioso", religione: "Culto delle Ombre" as const };
        }
        if (a.lavoro === "Capo Religioso") {
          if (a.religione === "Culto del Sole" && a.id !== capoReligiosoSole) {
            return { ...a, lavoro: "Disoccupato", reddito: a.ruoloSchiavitu ? 0 : 0 };
          }
          if (a.religione === "Culto delle Ombre" && a.id !== capoReligiosoAlieni) {
            return { ...a, lavoro: "Disoccupato", reddito: a.ruoloSchiavitu ? 0 : 0 };
          }
        }
        return a;
      })
    );
  }, [capoReligiosoSole, capoReligiosoAlieni, simulationEnabled]);

  // Rimuove i template di catalogo (id 30/31) se finiti per errore nell'elenco edifici.
  useEffect(() => {
    if (!simulationEnabled) return;
    setEdifici((prev) =>
      prev.filter(
        (e) =>
          e.tipo !== "Luogo di Culto" ||
          (e.id !== TEMPLATE_ID_LUOGO_CULTO["Culto del Sole"] &&
            e.id !== TEMPLATE_ID_LUOGO_CULTO["Culto delle Ombre"])
      )
    );
  }, [simulationEnabled]);

  // Richiesta Luogo di Culto: si attiva appena i requisiti sono soddisfatti, senza attendere il cambio mese.
  useEffect(() => {
    if (!simulationEnabled) return;
    if (pendingRichiestaLuogoCulto != null) return;
    const next = calcolaPendingRichiestaLuogoCulto(
      abitanti,
      edifici,
      capoReligiosoSole,
      capoReligiosoAlieni,
      richiesteInAttesa,
      luoghiCultoRifiutati
    );
    if (next) setPendingRichiestaLuogoCulto(next);
  }, [
    abitanti,
    edifici,
    capoReligiosoSole,
    capoReligiosoAlieni,
    pendingRichiestaLuogoCulto,
    richiesteInAttesa,
    luoghiCultoRifiutati,
    simulationEnabled
  ]);

  // Configurazione legge razziale
  const [leggeRazzialeAttiva, setLeggeRazzialeAttiva] = useState(false);
  const [razzaCampoLavoro, setRazzaCampoLavoro] = useState<Razza | null>(null);
  const [razzaCampoSterminio, setRazzaCampoSterminio] = useState<Razza | null>(null);
  
  // Configurazione età minima sul lavoro
  const [etaMinimaLavoro, setEtaMinimaLavoro] = useState(18); // Età minima di default

  // Età pensionabile: oltre questa età l'abitante diventa "Pensionato" e riceve assegno mensile; non lavora
  const [etaPensionabile, setEtaPensionabile] = useState(65);
  const [assegnoPensionati, setAssegnoPensionati] = useState(ASSEGNO_PENSIONATI_DEFAULT);
  
  // Configurazione legge sulle droghe
  const [leggeDroghe, setLeggeDroghe] = useState<"vietate" | "legali" | "parziali">("vietate"); // Stato delle droghe
  
  // Configurazione divieto di espatrio
  const [divietoEspatrioAttivo, setDivietoEspatrioAttivo] = useState(false);
  const [coprifuocoAttivo, setCoprifuocoAttivo] = useState(false);
  const [coprifuocoInizioMinuti, setCoprifuocoInizioMinutiState] = useState(22 * 60);
  const [coprifuocoFineMinuti, setCoprifuocoFineMinutiState] = useState(6 * 60);
  const setCoprifuocoInizioMinuti = useCallback((minuti: number) => {
    const m = Math.floor(minuti);
    const day = ((m % (24 * 60)) + 24 * 60) % (24 * 60);
    setCoprifuocoInizioMinutiState(day);
  }, []);
  const setCoprifuocoFineMinuti = useCallback((minuti: number) => {
    const m = Math.floor(minuti);
    const day = ((m % (24 * 60)) + 24 * 60) % (24 * 60);
    setCoprifuocoFineMinutiState(day);
  }, []);

  // Ius primae noctis: se attivo aggiunge +1 alle sanzioni; in evento Matrimonio permette di scegliere uno dei due e 50% incinta se sesso opposto al Re
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
  const [redditoCittadinanza, setRedditoCittadinanza] = useState(REDDITO_CITTADINANZA_DEFAULT);

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

  // Felicità modificata per politica religiosa, legge droghe, bisogni e abitazione
  const calcolaFelicitàModificata = useCallback(
    (abitante: Abitante): number =>
      calcolaFelicitàModificataPuro(abitante, {
        politicaReligiosa,
        religioneDiStato,
        leggeDroghe,
        nomeResidenza: getEdificioAbitazione(abitante.id, edifici)?.nome ?? null
      }),
    [politicaReligiosa, religioneDiStato, leggeDroghe, edifici]
  );

  const processaCambioMeseAutomatico = useCallback(() => {
    if (!isSimulationRunning(gamePhaseRef.current)) return;

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
      tipologieFamigliaAccettate,
      moneteGiocatore
    });

    const tasseUnlock = tasseSbloccate(obiettiviCompletati, gameMode);
    const tasseMese = applicaTasseMensili({
      abitanti: result.abitanti,
      edifici: result.edifici,
      configReddito: {
        tipo: "flat",
        flatPercentuale: 0,
        scaglioni: [{ min: 0, max: Infinity, percentuale: 0 }]
      },
      tassaPatrimonioPercentuale: tasseUnlock.has("patrimonio")
        ? tassaPatrimonioPercentuale
        : 0,
      ivaPercentuale: tasseUnlock.has("iva") ? ivaPercentuale : 0
    });

    setNativiNonIntegrati((prev) => prev + result.deltaNativiNonIntegrati);
    if (result.pendingAssimilazione != null) setPendingAssimilazione(result.pendingAssimilazione);
    if (result.pendingMatrimonio != null) setPendingMatrimonio(result.pendingMatrimonio);
    if (result.newIdNascita != null) setNextId(result.newIdNascita + 1);
    setEventiInCorso(result.eventiInCorso);

    const dopoCarcere = avanzaCarcereResiduoPuro(tasseMese.abitanti, result.edifici);
    const abitantiConModificatoriPuliti = dopoCarcere.abitanti.map((a) =>
      pulisciModificatoriScaduti(a, giornoGioco, result.nuovoMese, result.nuovoAnno)
    );
    const risorseAggiornate = estraiCreditiLegacyDaRisorse(result.risorse).risorse;
    const moneteAggiornate =
      result.moneteGiocatore + tasseMese.gettitoPatrimonio + tasseMese.gettitoIva;

    setAbitanti(abitantiConModificatoriPuliti);
    setEdifici(dopoCarcere.edifici);
    setRisorse(risorseAggiornate);
    setMoneteGiocatore(moneteAggiornate);
    setMese(result.nuovoMese);
    setAnno(result.nuovoAnno);
    setOrdiniMercato([]);
    generaNuoviAbitantiProposti();

    // Valuta i nuovi obiettivi completati al cambio mese, solo in modalità Avventura.
    if (gameMode === "avventura") {
      const haPonte = mappaHaPonteOperativo(
        getMappaSessione()?.edificiInMappa ?? {},
        dopoCarcere.edifici
      );
      setObiettiviCompletati((prevCompletati) => {
        const completatiSet = new Set(prevCompletati);
        const sbloccati = obiettiviSbloccati(completatiSet);
        let aggiornato = false;

        for (const id of sbloccati) {
          if (completatiSet.has(id)) continue;
          const nodo = OBIETTIVI_CATALOGO.find((o) => o.id === id);
          if (!nodo) continue;

          const soddisfatto = nodo.condizione({
            abitanti: abitantiConModificatoriPuliti,
            edifici: dopoCarcere.edifici,
            risorse: risorseAggiornate,
            mese: result.nuovoMese,
            anno: result.nuovoAnno,
            moneteGiocatore: moneteAggiornate,
            completati: completatiSet,
            haPonteSulFiume: haPonte
          });

          if (soddisfatto) {
            completatiSet.add(id);
            aggiornato = true;
          }
        }

        return aggiornato ? [...completatiSet] : prevCompletati;
      });
    }

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
  }, [abitanti, edifici, risorse, ordiniMercato, eventiInCorso, punteggioSanzioni, mese, anno, giornoGioco, generaNuoviAbitantiProposti, divietoEspatrioAttivo, calcolaFelicitàModificata, politicaNascite, nextId, etaPensionabile, assegnoPensionati, soddisfazioneFazioni, prezzoResidenze, redditoCittadinanza, modalitaSanita, tipologieFamigliaAccettate, moneteGiocatore, gameMode, obiettiviCompletati, tassaPatrimonioPercentuale, ivaPercentuale]);

  /**
   * Nessun pulsante «Skip Mese»: il cambio mese parte automaticamente ogni 30 giorni
   * dell'orologio continuo. Se un salvataggio legacy aveva mese/anno più avanti del
   * giorno globale, l'offset mantiene quella cronologia senza far tornare indietro il calendario.
   */
  useEffect(() => {
    if (!simulationEnabled) return;
    const indiceTarget = indiceMeseDaGiornoGioco(giornoGioco, offsetMesiOrologioRef.current);
    const indiceAttuale = indiceCalendarioGioco(mese, anno);
    if (indiceTarget <= indiceAttuale) return;
    processaCambioMeseAutomatico();
  }, [giornoGioco, mese, anno, simulationEnabled, processaCambioMeseAutomatico]);

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

  /** Esercita Ius primae noctis su un abitante (evento Matrimonio): se sesso opposto al Re, 50% diventa incinta. Poi chiude il matrimonio. */
  const esercitaIusPrimaeNoctis = useCallback(
    (abitanteId: number) => {
      const re = abitanti.find((a) => a.id === 1);
      const scelto = abitanti.find((a) => a.id === abitanteId);
      if (!scelto || scelto.razza === "Golem") {
        setPendingMatrimonio(null);
        return;
      }
      const sessoRe = re?.sesso ?? "M";
      const sessoScelto = scelto.sesso ?? "F";
      const opposto = (sessoRe === "M" && sessoScelto === "F") || (sessoRe === "F" && sessoScelto === "M");
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
    if (!simulationEnabled) return;
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
  }, [pendingMatrimonio, confermaMatrimonio, rifiutaMatrimonio, iusPrimaeNoctisAttivo, esercitaIusPrimaeNoctis, simulationEnabled]);

  /** Creazione personaggio Re a inizio partita (prima degli eventi). */
  const [creazioneGiocatoreAperta, setCreazioneGiocatoreAperta] = useState(false);
  const [diarioInizioVisto, setDiarioInizioVisto] = useState(false);
  const startNewGame = useCallback((mode: GameMode = "avventura") => {
    const colonia = generaColoniaIniziale(mode);
    setGameMode(mode);
    setObiettiviCompletati([]);
    setMese(1);
    setAnno(0);
    offsetMesiOrologioRef.current = 0;
    ultimoGiornoPastiRef.current = 0;
    ultimoGiornoProduzioneSerraRef.current = 1;
    ultimoGiornoEconomiaPubblicaRef.current = 1;
    setOrologioGiocoBloccatoDallaFase(true);
    restoreOrologioGioco({ giorno: 1, minutiDaMezzanotte: 6 * 60, pausaManuale: false });
    setTassaPatrimonioPercentuale(TASSA_PATRIMONIO_PERCENTUALE_DEFAULT);
    setIvaPercentuale(IVA_PERCENTUALE_DEFAULT);
    setColtureSerraSbloccate(mode === "creativa" ? tutteColtureSerraSbloccate() : [COLTURA_SERRA_DEFAULT]);
    setAbitanti(colonia.abitanti);
    setRazzaNativi(colonia.razzaNativi);
    setEdifici(creaEdificiIniziali(colonia.abitanti, mode));
    setNextId(colonia.abitanti.length + 100);
    gamePhaseRef.current = "commander-creation";
    setGamePhase("commander-creation");
    setCreazioneGiocatoreAperta(true);
  }, []);
  const configuraGiocatore = useCallback((dati: DatiCreazioneGiocatore) => {
    const nomeCompleto = [dati.nome.trim(), dati.cognome.trim()].filter(Boolean).join(" ");
    if (!nomeCompleto) return;
    setAbitanti((prev) => {
      const conRe = prev.map((a) =>
        a.id === ID_GIOCATORE
          ? {
              ...a,
              nome: nomeCompleto,
              sesso: dati.sesso,
              orientamento: dati.orientamento,
              razza: dati.razza,
              aspetto: dati.aspetto,
              lavoro: LAVORO_GIOCATORE,
              eta: ETA_GIOCATORE_INIZIALE,
              emoji: "👑"
            }
          : a
      );
      return sincronizzaCuginoNobileConRe(conRe);
    });
    setCreazioneGiocatoreAperta(false);
    setDiarioInizioVisto(true);
    gamePhaseRef.current = "activating";
    setGamePhase("activating");
  }, []);

  // Un ciclo separato chiude l'introduzione prima di permettere qualunque effetto automatico.
  useEffect(() => {
    if (gamePhase !== "activating") return;
    const id = setTimeout(() => setGamePhase("running"), 0);
    return () => clearTimeout(id);
  }, [gamePhase]);

  useEffect(() => {
    setOrologioGiocoBloccatoDallaFase(!simulationEnabled);
  }, [simulationEnabled]);

  const restorePersistableState = useCallback((state: PersistableGameState) => {
    setGameMode(state.gameMode);
    setObiettiviCompletati(state.obiettiviCompletati ?? []);
    setColtureSerraSbloccate(
      normalizzaColtureSerraSbloccate({
        sbloccate: state.coltureSerraSbloccate,
        modalitaGioco: state.gameMode,
        obiettiviCompletati: state.obiettiviCompletati,
        colturaSerraCorrente: state.edifici.find((e) => e.nome === "Serra")?.colturaItemId
      })
    );
    gamePhaseRef.current = "restoring";
    setGamePhase("restoring");
    setOrologioGiocoBloccatoDallaFase(true);
    setAbitanti(state.abitanti);
    setRazzaNativi(state.razzaNativi);
    setInventarioGiocatore(state.inventarioGiocatore);
    setMoneteGiocatore(state.moneteGiocatore);
    setInventarioMensaByEdificioId(state.inventarioMensaByEdificioId);
    setRisorse(state.risorse);
    setEdifici(state.edifici);
    setMese(state.mese);
    setAnno(state.anno);
    offsetMesiOrologioRef.current = offsetMesiPerCalendarioSalvato(
      state.giorno,
      state.mese,
      state.anno
    );
    setAbitantiProposti(state.abitantiProposti);
    setNextId(state.nextId);
    setOrdiniMercato(state.ordiniMercato);
    setEventiInCorso(state.eventiInCorso);
    setNativiNonIntegrati(state.nativiNonIntegrati);
    setPendingAssimilazione(state.pendingAssimilazione);
    setPendingMatrimonio(state.pendingMatrimonio);
    setMessaggioEmigrazione(state.messaggioEmigrazione);
    setDiarioRighe(state.diarioRighe);
    setSoddisfazioneFazioni(state.soddisfazioneFazioni);
    setTipoTassaReddito(state.tipoTassaReddito);
    setFlatTaxPercentuale(state.flatTaxPercentuale);
    setScaglioniConfig(state.scaglioniConfig);
    setTassaPatrimonioPercentuale(state.tassaPatrimonioPercentuale);
    setIvaPercentuale(state.ivaPercentuale);
    setPoliticaNascite(state.politicaNascite);
    setPunteggioSanzioni(state.punteggioSanzioni);
    setPenaDiMorteAttiva(state.penaDiMorteAttiva);
    setPenaReati(state.penaReati);
    setPoliticaReligiosa(state.politicaReligiosa);
    setReligioneDiStato(state.religioneDiStato);
    setReligioniCustom(state.religioniCustom ?? []);
    setCapoReligiosoSole(state.capoReligiosoSole);
    setCapoReligiosoAlieni(state.capoReligiosoAlieni);
    setPendingRichiestaLuogoCulto(state.pendingRichiestaLuogoCulto);
    setLuoghiCultoPendentiMappa(state.luoghiCultoPendentiMappa);
    setRichiesteInAttesa(state.richiesteInAttesa);
    setLuoghiCultoRifiutati(state.luoghiCultoRifiutati);
    setLeggeRazzialeAttiva(state.leggeRazzialeAttiva);
    setRazzaCampoLavoro(state.razzaCampoLavoro);
    setRazzaCampoSterminio(state.razzaCampoSterminio);
    setEtaMinimaLavoro(state.etaMinimaLavoro);
    setEtaPensionabile(state.etaPensionabile);
    setAssegnoPensionati(state.assegnoPensionati);
    setLeggeDroghe(state.leggeDroghe);
    setDivietoEspatrioAttivo(state.divietoEspatrioAttivo);
    setCoprifuocoAttivo(state.coprifuocoAttivo);
    setCoprifuocoInizioMinutiState(state.coprifuocoInizioMinuti);
    setCoprifuocoFineMinutiState(state.coprifuocoFineMinuti);
    setIusPrimaeNoctisAttivo(state.iusPrimaeNoctisAttivo);
    setTipologieFamigliaAccettate(state.tipologieFamigliaAccettate);
    setRedditoCittadinanza(state.redditoCittadinanza);
    setModalitaSanita(state.modalitaSanita);
    setPrezzoResidenzeState(state.prezzoResidenze);
    setDiarioInizioVisto(state.diarioInizioVisto);
    ultimoGiornoPastiRef.current = state.ultimoGiornoPasti;
    ultimoGiornoProduzioneSerraRef.current = state.ultimoGiornoProduzioneSerra;
    ultimoGiornoEconomiaPubblicaRef.current = state.ultimoGiornoEconomiaPubblica;
    restoreOrologioGioco(state);
    setMappaSessione(state.mappa);
    setCreazioneGiocatoreAperta(!state.introductionCompleted);
    setTimeout(() => setGamePhase(state.introductionCompleted ? "running" : "commander-creation"), 0);
  }, []);

  const createPersistableState = useCallback((mappa: MappaRuntimeState): PersistableGameState => {
    const clock = getOrologioPersistableSnapshot();
    return {
      gameMode,
      gamePhase: gamePhase === "running" ? "running" : gamePhase === "activating" ? "activating" : "commander-creation",
      introductionCompleted: diarioInizioVisto,
      diarioInizioVisto,
      abitanti, abitantiProposti, nextId, razzaNativi, nativiNonIntegrati,
      edifici, risorse, inventarioGiocatore, inventarioMensaByEdificioId, moneteGiocatore, prezzoResidenze,
      mese, anno, ...clock,
      ultimoGiornoPasti: ultimoGiornoPastiRef.current,
      ultimoGiornoProduzioneSerra: ultimoGiornoProduzioneSerraRef.current,
      ultimoGiornoEconomiaPubblica: ultimoGiornoEconomiaPubblicaRef.current,
      tipoTassaReddito, flatTaxPercentuale, scaglioniConfig, tassaPatrimonioPercentuale, ivaPercentuale, politicaNascite, punteggioSanzioni,
      penaDiMorteAttiva, penaReati, politicaReligiosa, religioneDiStato, religioniCustom, leggeRazzialeAttiva,
      razzaCampoLavoro, razzaCampoSterminio, etaMinimaLavoro, etaPensionabile, assegnoPensionati,
      leggeDroghe, divietoEspatrioAttivo, coprifuocoAttivo, coprifuocoInizioMinuti,
      coprifuocoFineMinuti, iusPrimaeNoctisAttivo, tipologieFamigliaAccettate,
      redditoCittadinanza, modalitaSanita, ordiniMercato, eventiInCorso, soddisfazioneFazioni,
      pendingAssimilazione, pendingMatrimonio, messaggioEmigrazione, diarioRighe,
      capoReligiosoSole, capoReligiosoAlieni, pendingRichiestaLuogoCulto, richiesteInAttesa,
      luoghiCultoRifiutati, luoghiCultoPendentiMappa, obiettiviCompletati, coltureSerraSbloccate, mappa
    };
  }, [gameMode, gamePhase, diarioInizioVisto, abitanti, abitantiProposti, nextId, razzaNativi, nativiNonIntegrati,
    edifici, risorse, inventarioGiocatore, inventarioMensaByEdificioId, moneteGiocatore, prezzoResidenze,
    mese, anno, tipoTassaReddito, flatTaxPercentuale, scaglioniConfig, tassaPatrimonioPercentuale, ivaPercentuale, politicaNascite, punteggioSanzioni,
    penaDiMorteAttiva, penaReati, politicaReligiosa, religioneDiStato, religioniCustom, leggeRazzialeAttiva,
    razzaCampoLavoro, razzaCampoSterminio, etaMinimaLavoro, etaPensionabile, assegnoPensionati,
    leggeDroghe, divietoEspatrioAttivo, coprifuocoAttivo, coprifuocoInizioMinuti, coprifuocoFineMinuti,
    iusPrimaeNoctisAttivo, tipologieFamigliaAccettate, redditoCittadinanza, modalitaSanita,
    ordiniMercato, eventiInCorso, soddisfazioneFazioni, pendingAssimilazione, pendingMatrimonio,
    messaggioEmigrazione, diarioRighe, capoReligiosoSole, capoReligiosoAlieni,
    pendingRichiestaLuogoCulto, richiesteInAttesa, luoghiCultoRifiutati, luoghiCultoPendentiMappa,
    obiettiviCompletati, coltureSerraSbloccate]);
  const chiudiMessaggioEmigrazione = useCallback(() => setMessaggioEmigrazione(null), []);

  useEffect(() => {
    if (gameMode !== "creativa" && !obiettiviCompletati.includes("raccolto_serra")) return;
    setColtureSerraSbloccate((prev) => {
      const tutte = tutteColtureSerraSbloccate();
      return prev.length === tutte.length && tutte.every((id) => prev.includes(id)) ? prev : tutte;
    });
  }, [gameMode, obiettiviCompletati]);

  /**
   * Ogni «Agricoltore» finisce in una Serra operativa con posto libero; poi il lavoro segue le assegnazioni.
   * Eseguito in un solo passaggio per evitare stati intermedi (es. immigrato Agricoltore demotato a Disoccupato).
   */
  useEffect(() => {
    if (!simulationEnabled) return;
    const { abitanti: nextA, edifici: nextE } = normalizzaLavoroEAgricoltura(abitanti, edifici);
    if (nextA !== abitanti) setAbitanti(nextA);
    if (nextE !== edifici) setEdifici(nextE);
  }, [abitanti, edifici, simulationEnabled]);

  const creaReligioneCustom = useCallback(
    (input: {
      nome: string;
      emoji?: string;
      descrizione?: string;
      aspettoSacerdote?: import("../game/personaggioAspetto").AspettoPersonaggio;
    }) => {
      const result = provaCreaReligioneCustom(input, religioniCustom, () => `rel-${Date.now()}`);
      if (result.ok) {
        setReligioniCustom((prev) => [...prev, result.religione]);
      }
      return result;
    },
    [religioniCustom]
  );

  useEffect(() => {
    if (!simulationEnabled) return;
    const next = assicuraReligioneTempioChiese(edifici, religioniCustom);
    if (next !== edifici) setEdifici(next);
  }, [edifici, religioniCustom, simulationEnabled]);

  const assegnaAbitanteAEdificio = useCallback((abitanteId: number, edificioId: number) => {
    const abitante = abitanti.find((a) => a.id === abitanteId);
    if (!abitante || abitante.lavoro === "Pensionato") return;
    const edificioCorrente = edifici.find((e) => e.id === edificioId);
    if (!edificioCorrente) return;
    const lavoroEdificio = getLavoroPerEdificio(edificioCorrente);
    if (lavoroEdificio && getCastaAbitante(abitante) !== "Servo della gleba") return;
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

  const setColturaSerra = useCallback((edificioId: number, colturaItemId: string) => {
    if (!isColturaSerraValida(colturaItemId)) return;
    if (gameMode === "avventura" && !coltureSerraSbloccate.includes(colturaItemId)) return;
    setEdifici((prev) =>
      prev.map((e) =>
        e.id === edificioId && e.nome === "Serra" ? { ...e, colturaItemId } : e
      )
    );
  }, [gameMode, coltureSerraSbloccate]);

  /** Crea un nuovo edificio nel modello di gioco a partire da una riga del catalogo (nuovo id univoco).
   *  Se `costoMateriale` > 0 e non c'è abbastanza Materiale Edile, restituisce null.
   *  Di default gli edifici partono «In costruzione» (tranne Ufficio Edile e Capanna). */
  const aggiungiEdificioDaTemplate = useCallback(
    (
      templateId: number,
      options?: { costoMateriale?: number; stato?: Edificio["stato"] }
    ): number | null => {
      const template = edificiData.find((x) => x.id === templateId);
      if (!template) return null;
      const costo = options?.costoMateriale ?? 0;
      if (!haMaterialeEdileSufficiente(risorse, costo)) return null;

      const stato =
        options?.stato ??
        (edificioParteInCostruzione(template.nome) ? "In costruzione" : "Operativo");

      let createdId: number | null = null;
      if (costo > 0) {
        setRisorse((prev) => consumaMaterialeEdile(prev, costo));
      }
      setEdifici((prev) => {
        const newId = Math.max(0, ...prev.map((x) => x.id)) + 1;
        createdId = newId;
        const nuovo: Edificio = {
          ...template,
          id: newId,
          abitantiAssegnati: [],
          occupazione: 0,
          stato,
          progressoCostruzione: stato === "In costruzione" ? 0 : undefined,
          stipendioPerLavoratore:
            template.stipendioPerLavoratore ??
            (isEdificioPubblicoConPostazioniLavoro({ ...template, stato: "Operativo" })
              ? STIPENDIO_BASE_MONETE_MESE
              : undefined)
        };
        return [...prev, nuovo];
      });
      return createdId;
    },
    [risorse]
  );

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

  const aggiornaAbitanteById = useCallback((abitanteId: number, fn: (a: Abitante) => Abitante) => {
    setAbitanti((prev) => prev.map((a) => (a.id === abitanteId ? fn(a) : a)));
  }, []);

  /** Accredita monete al tesoro (sink bar/negozio → stipendi). */
  const aggiornaEdificioById = useCallback(
    (edificioId: number, update: (e: Edificio) => Edificio) => {
      setEdifici((prev) => prev.map((e) => (e.id === edificioId ? update(e) : e)));
    },
    []
  );

  const applicaEsitoChiacchieraAbitanti = useCallback((idA: number, idB: number) => {
    setAbitanti((prev) => applicaEsitoChiacchieraSuLista(prev, idA, idB));
  }, []);

  const accreditaMoneteGiocatore = useCallback((quantità: number) => {
    const q = Math.floor(quantità);
    if (q <= 0) return;
    setMoneteGiocatore((prev) => prev + q);
  }, []);

  /** Appende una riga al diario di gioco (avvisi soft, es. furto scoperto). */
  const appendDiarioRiga = useCallback((riga: string) => {
    const t = (riga ?? "").trim();
    if (!t) return;
    setDiarioRighe((prev) => [...prev, t]);
  }, []);

  /**
   * Prelievo forzoso immediato: fino all'importo indicato da ogni suddito imponibile.
   * Il gettito va al Tesoro e il malus di soddisfazione resta separato dalla felicità.
   */
  const eseguiPrelievoForzosoRe = useCallback(
    (importoPerAbitante: number): { gettito: number; soggettiColpiti: number } => {
      const result = eseguiPrelievoForzoso({
        abitanti,
        importoPerAbitante,
        mese,
        anno
      });
      if (result.gettito <= 0) return { gettito: 0, soggettiColpiti: 0 };
      setAbitanti(result.abitanti);
      setMoneteGiocatore((prev) => prev + result.gettito);
      appendDiarioRiga(
        `Prelievo forzoso: ${result.gettito} monete raccolte da ${result.soggettiColpiti} abitanti (${Math.floor(importoPerAbitante)} monete/capo).`
      );
      return { gettito: result.gettito, soggettiColpiti: result.soggettiColpiti };
    },
    [abitanti, mese, anno, appendDiarioRiga]
  );

  /** Aggiorna le scorte di una Mensa (es. furto). */
  const setInventarioMensaEdificio = useCallback(
    (edificioId: number, inventario: { itemId: string; quantità: number }[]) => {
      setInventarioMensaByEdificioId((prev) => ({
        ...prev,
        [edificioId]: normalizzaInventarioMensa(inventario)
      }));
    },
    []
  );

  const setAbitanteIncinta = useCallback((abitanteId: number, incinta: boolean) => {
    setAbitanti((prev) =>
      prev.map((a) => (a.id === abitanteId ? { ...a, incinta } : a))
    );
  }, []);

  const serviPastoMensaAbitante = useCallback((abitanteId: number, edificioId: number) => {
    const mensaInv = normalizzaInventarioMensa(inventarioMensaRef.current[edificioId]);
    const giorno = getGiornoGiocoSnapshot();
    setAbitanti((prev) => {
      let carestia = false;
      const next = prev.map((a) => {
        if (a.id !== abitanteId) return a;
        const { abitante, inventarioMensa, carestiaMensa } = serviPastoMensaTransaction(a, mensaInv, giorno);
        if (carestiaMensa) carestia = true;
        setInventarioMensaByEdificioId((prevM) => ({
          ...prevM,
          [edificioId]: inventarioMensa
        }));
        return abitante;
      });
      if (carestia) {
        setEventiInCorso((ev) => attivaEventoCarestia(ev, meseRef.current, annoRef.current));
      }
      return next;
    });
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

  const costruisciLuogoCulto = useCallback(
    (religione: ReligioneConCulto) => {
      if (haLuogoCulto(religione, edifici)) return;
      const templateId = TEMPLATE_ID_LUOGO_CULTO[religione];
      const template = edificiData.find((x) => x.id === templateId);
      if (!template) return;

      const newId = Math.max(0, ...edifici.map((x) => x.id)) + 1;
      setEdifici((prev) => [
        ...prev,
        {
          ...template,
          id: newId,
          abitantiAssegnati: [],
          occupazione: 0,
          stato: "Operativo" as const
        }
      ]);

      // Il piazzamento 2×2 avviene sulla pagina Mappa (sincronizza sessione + stato React).
      setLuoghiCultoPendentiMappa((prev) => {
        if (prev.some((p) => p.religione === religione)) return prev;
        return [...prev, { religione, edificioGlobaleId: newId }];
      });
    },
    [edifici]
  );

  const accettaRichiestaLuogoCulto = useCallback(() => {
    const richiesta = pendingRichiestaLuogoCulto;
    setPendingRichiestaLuogoCulto(null);
    if (!richiesta) return;
    costruisciLuogoCulto(richiesta.religione);
  }, [pendingRichiestaLuogoCulto, costruisciLuogoCulto]);

  const rifiutaRichiestaLuogoCulto = useCallback(() => {
    const richiesta = pendingRichiestaLuogoCulto;
    setPendingRichiestaLuogoCulto(null);
    if (!richiesta) return;
    setLuoghiCultoRifiutati((prev) =>
      prev.includes(richiesta.religione) ? prev : [...prev, richiesta.religione]
    );
  }, [pendingRichiestaLuogoCulto]);

  const rimandaRichiestaLuogoCulto = useCallback(() => {
    const richiesta = pendingRichiestaLuogoCulto;
    setPendingRichiestaLuogoCulto(null);
    if (!richiesta) return;
    setRichiesteInAttesa((prev) => {
      if (prev.some((r) => r.tipo === "luogo-culto" && r.religione === richiesta.religione)) return prev;
      const nuova = creaRichiestaLuogoCulto(richiesta.id, richiesta.nome, richiesta.religione, mese, anno);
      if (prev.some((r) => r.id === nuova.id)) return prev;
      return [...prev, nuova];
    });
  }, [pendingRichiestaLuogoCulto, mese, anno]);

  const accettaRichiestaInAttesa = useCallback(
    (richiestaId: string) => {
      const richiesta = richiesteInAttesa.find((r) => r.id === richiestaId);
      if (!richiesta) return;
      if (richiesta.tipo === "luogo-culto") {
        costruisciLuogoCulto(richiesta.religione);
      }
      setRichiesteInAttesa((prev) => prev.filter((r) => r.id !== richiestaId));
    },
    [richiesteInAttesa, costruisciLuogoCulto]
  );

  const rifiutaRichiestaInAttesa = useCallback((richiestaId: string) => {
    setRichiesteInAttesa((prev) => {
      const richiesta = prev.find((r) => r.id === richiestaId);
      if (richiesta?.tipo === "luogo-culto") {
        setLuoghiCultoRifiutati((rifiutati) =>
          rifiutati.includes(richiesta.religione) ? rifiutati : [...rifiutati, richiesta.religione]
        );
      }
      return prev.filter((r) => r.id !== richiestaId);
    });
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

  const setPenaReato = useCallback((reato: ReatoPunibile, anni: number) => {
    const value = Math.max(0, Math.floor(anni));
    setPenaReati((prev) => ({ ...prev, [reato]: value }));
  }, []);

  const faiDecidereAlGiudice = useCallback(
    (abitanteId: number): RisultatoGiudizio => {
      const imputato = abitanti.find((a) => a.id === abitanteId);
      const tribunaleEd = edifici.find((e) => e.nome === "Tribunale");
      const giudicePresente = (tribunaleEd?.abitantiAssegnati?.length ?? 0) > 0;
      const esito = valutaSentenzaGiudice(imputato, giudicePresente, penaReati);
      if (!esito.ok) return esito;

      if (esito.anni > 0) {
        const r = condannaAlCampoDiLavoroPuro(abitanti, edifici, abitanteId, esito.anni);
        if (!r.ok) return { ok: false, messaggio: r.messaggio };
        setAbitanti(r.abitanti);
        setEdifici(r.edifici);
        return esito;
      }

      setAbitanti((prev) =>
        prev.map((a) => (a.id === abitanteId ? { ...a, reati: [] } : a))
      );
      return esito;
    },
    [abitanti, edifici, penaReati]
  );

  const condannaLavoriForzati = useCallback(
    (abitanteId: number): { ok: boolean; messaggio: string } => {
      const r = condannaAlCampoDiLavoroPuro(abitanti, edifici, abitanteId);
      if (r.ok) {
        setAbitanti(r.abitanti);
        setEdifici(r.edifici);
      }
      return { ok: r.ok, messaggio: r.messaggio };
    },
    [abitanti, edifici]
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
      const edificio = edifici.find((e) => e.id === edificioId);
      if (!abitante || !edificio || getCastaAbitante(abitante) !== "Servo della gleba") return;
      if (!edificioAccettaServiDellaGleba(edificio)) return;
      assegnaAbitanteAEdificio(abitanteId, edificioId);
    },
    [abitanti, edifici, assegnaAbitanteAEdificio]
  );

  /** Cittadino disoccupato che sulla mappa raggiunge un posto vacante → assunto. */
  const assumiCittadinoDisoccupatoAEdificio = useCallback(
    (abitanteId: number, edificioId: number): boolean => {
      const r = assumiCittadinoDisoccupatoInEdificio(abitanti, edifici, abitanteId, edificioId);
      if (!r.ok) return false;
      setAbitanti(r.abitanti);
      setEdifici(r.edifici);
      return true;
    },
    [abitanti, edifici]
  );

  const trasferisciProprietaSchiavo = useCallback(
    (schiavoId: number, nuovoProprietarioId: number | null, prezzo: number = PREZZO_SCHIAVO_DEFAULT) => {
      const result = trasferisciProprietaSchiavoPuro({
        abitanti,
        moneteGiocatore,
        schiavoId,
        nuovoProprietarioId,
        prezzo
      });
      if (!result.ok) return false;
      setAbitanti(result.abitanti);
      setMoneteGiocatore(result.moneteGiocatore);
      return true;
    },
    [abitanti, moneteGiocatore]
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

  // Mercato: ordini di acquisto/vendita; si eseguono al cambio mese automatico.
  const aggiungiOrdineMercato = useCallback(
    (tipo: "compra" | "vendi", risorsaId: number, quantità: number, prezzoUnitario: number): boolean => {
      const result = aggiungiOrdineMercatoPuro({
        tipo,
        risorsaId,
        quantità,
        prezzoUnitario,
        ordiniCorrenti: ordiniMercato,
        risorse,
        moneteGiocatore
      });
      if (!result.success) return false;
      setOrdiniMercato((prev) => [...prev, result.nuovoOrdine]);
      return true;
    },
    [risorse, ordiniMercato, moneteGiocatore]
  );

  const rimuoviOrdineMercato = useCallback((ordineId: number) => {
    setOrdiniMercato((prev) => prev.filter((o) => o.id !== ordineId));
  }, []);

  // Delta risorse dall'anteprima ordini (per mostrare in Home l'effetto al cambio mese)
  const calcolaDeltaOrdiniMercato = useCallback((): Record<string, number> => {
    return calcolaDeltaOrdiniMercatoPuro(ordiniMercato, risorse);
  }, [ordiniMercato, risorse]);

  const calcolaDeltaTesoroMercato = useCallback((): number => {
    return calcolaDeltaTesoroOrdiniMercato(ordiniMercato);
  }, [ordiniMercato]);

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
    if (!simulationEnabled) return;
    const nuovoPunteggio = calcolaPunteggioSanzioni();
    setPunteggioSanzioni(nuovoPunteggio);
  }, [calcolaPunteggioSanzioni, simulationEnabled]);

  return {
    gameMode,
    modalitaGioco: gameMode,
    obiettiviCompletati,
    coltureSerraSbloccate,
    gamePhase,
    simulationEnabled,
    startNewGame,
    restorePersistableState,
    createPersistableState,
    abitanti,
    inventarioGiocatore,
    moneteGiocatore,
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
    tassaPatrimonioPercentuale,
    ivaPercentuale,
    politicaNascite,
    punteggioSanzioni,
    penaDiMorteAttiva,
    penaReati,
    setPenaReato,
    faiDecidereAlGiudice,
    condannaLavoriForzati,
    politicaReligiosa,
    leggeRazzialeAttiva,
    razzaCampoLavoro,
    razzaCampoSterminio,
    capoReligiosoSole,
    capoReligiosoAlieni,
    religioneDiStato,
    religioniCustom,
    creaReligioneCustom,
    etaMinimaLavoro,
    etaPensionabile,
    assegnoPensionati,
    leggeDroghe,
    divietoEspatrioAttivo,
    coprifuocoAttivo,
    coprifuocoInizioMinuti,
    coprifuocoFineMinuti,
    iusPrimaeNoctisAttivo,
    tipologieFamigliaAccettate,
    modalitaSanita,
    redditoCittadinanza,
    setTipoTassaReddito,
    setFlatTaxPercentuale,
    setScaglioniConfig,
    setTassaPatrimonioPercentuale,
    setIvaPercentuale,
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
    setCoprifuocoAttivo,
    setCoprifuocoInizioMinuti,
    setCoprifuocoFineMinuti,
    setIusPrimaeNoctisAttivo,
    setTipologieFamigliaAccettate,
    setRedditoCittadinanza,
    setModalitaSanita,
    setAbitanteIncinta,
    serviPastoMensaAbitante,
    trasferisciCiboGiocatoreAMensa,
    calcolaFelicitàModificata,
    assegnaAbitanteAEdificio,
    rimuoviAbitanteDaEdificio,
    setStipendioEdificio,
    setColturaSerra,
    aggiungiEdificioDaTemplate,
    rimuoviEdificioPerId,
    prezzoResidenze,
    setPrezzoResidenza,
    aggiungiAlCampoDiLavoroTuttiQuelliChe,
    assegnaServoDellaGlebaAEdificio,
    assumiCittadinoDisoccupatoAEdificio,
    trasferisciProprietaSchiavo,
    uccidiSchiavo,
    nominaMinistro,
    rimuoviMinistro,
    setNomeAbitante,
    aggiornaAbitanteById,
    aggiornaEdificioById,
    applicaEsitoChiacchieraAbitanti,
    accreditaMoneteGiocatore,
    appendDiarioRiga,
    eseguiPrelievoForzosoRe,
    setInventarioMensaEdificio,
    calcolaProduzioneConsumo,
    accettaImmigrante,
    rifiutaImmigrante,
    ordiniMercato,
    aggiungiOrdineMercato,
    rimuoviOrdineMercato,
    calcolaDeltaOrdiniMercato,
    calcolaDeltaTesoroMercato,
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
    creazioneGiocatoreAperta,
    configuraGiocatore,
    diarioInizioVisto,
    messaggioEmigrazione,
    chiudiMessaggioEmigrazione,
    diarioRighe,
    pendingRichiestaLuogoCulto,
    accettaRichiestaLuogoCulto,
    rifiutaRichiestaLuogoCulto,
    rimandaRichiestaLuogoCulto,
    richiesteInAttesa,
    accettaRichiestaInAttesa,
    rifiutaRichiestaInAttesa,
    luoghiCultoRifiutati,
    luoghiCultoPendentiMappa,
    setLuoghiCultoPendentiMappa
  };
}
