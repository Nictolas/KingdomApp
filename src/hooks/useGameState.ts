import { useState, useCallback, useEffect, useRef } from "react";
import { Alert } from "react-native";
import type { Abitante, Risorsa, Edificio, OrdineMercato, EventoInCorso, Razza, Casta } from "../types";
import { risorseData, edificiData, pianetiData } from "../kingdomData";
import { estraiCreditiLegacyDaRisorse } from "../data/risorseData";
import { OBIETTIVI_CATALOGO, obiettiviSbloccati } from "../data/obiettiviCatalogo";
import { runAvanzaMese } from "../game/avanzaMese";
import { EVENTI_CATALOGO } from "../game/eventi/index";
import { generaColoniaIniziale, type ModalitaGiocoGenerazione } from "../game/generazionePartita";
import { aspettoCapoReligiosoSeNecessario } from "../game/personaggioAspetto";
import {
  ID_GIOCATORE,
  LAVORO_GIOCATORE,
  ETA_GIOCATORE_INIZIALE
} from "../game/schiavituCommercio";
import type { DatiCreazioneGiocatore } from "../ui/CreazioneGiocatoreModal";
import { capitalizzaNomePersona } from "../game/nomiUmani";
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
import { eseguiPrelievoForzoso } from "../game/tasse";
import { tasseSbloccate } from "../game/tasseSblocco";
import { applicaAdozione, haGenitoriVivi } from "../game/famiglia";
import { applicaEsitoChiacchieraSuLista } from "../game/relazioneChiacchiera";
import {
  messaggioFaseDisordine,
  setModalitaRePuro,
  STATO_RE_DEFAULT,
  tickModalitaReMensile,
  valutaFaseDisordine,
  type ModalitaRe,
  type FaseDisordine,
  type StatoRePolitica
} from "../game/reModalita";
import {
  applicaEffettiDisordineMensile,
  applicaPopolaritaDelta,
  edificioBuffVisitaCorrente,
  messaggioEsitoAttentato,
  tentaAttentatoAlRe
} from "../game/disordineRe";
import { getEdificioAbitazione } from "../game/abitanteEdifici";
import { generaImmigratiProposti } from "../game/immigrazione";
import { getLavoroPerEdificio, autoAssegnaCittadiniDisoccupati, normalizzaLavoroEAgricoltura, edificioAccettaServiDellaGleba, isEdificioPubblicoConPostazioniLavoro, assumiCittadinoDisoccupatoInEdificio } from "../game/edificiLavoro";
import { assumiDisoccupatoInEmporio } from "../game/emporioLavoro";
import { assumiDisoccupatoComeGuardia, postiLiberiGuardieCastello } from "../game/castelloGuardie";
import {
  eseguiVenditaAlimentoAllEmporio,
  normalizzaInventarioEmporio,
  creaInventarioEmporioIniziale,
  PREZZO_VENDITA_ALIMENTO_EMPORIO
} from "../game/emporioVendita";
import {
  appendRegistrazioneScambio,
  migraRegistrazioneEmporioLegacy,
  voceRegistrazioneCostruzione,
  voceRegistrazioneRaccoltaBosco,
  voceRegistrazioneRaccoltaMiniera,
  voceRegistrazioneRaccoltaSerra,
  type RegistrazioneScambio
} from "../game/registrazioniScambi";
import {
  avanzaCostruzioniEdifici,
  consumaMaterialeEdile,
  edificioParteInCostruzione,
  haMaterialeEdileSufficiente
} from "../game/costruzioneEdifici";
import {
  ASSEGNO_PENSIONATI_DEFAULT,
  GIORNI_MESE_ECONOMIA,
  IVA_PERCENTUALE_DEFAULT,
  REDDITO_CITTADINANZA_DEFAULT,
  STIPENDIO_BASE_MONETE_MESE,
  TASSA_PATRIMONIO_PERCENTUALE_DEFAULT
} from "../game/economiaPrezzi";
import {
  creaMoneteGiocatoreIniziali,
  pagaStipendiEdificiPubblici
} from "../game/edificiPubblici";
import {
  normalizzaEdificiCassaImpresa,
  pagaStipendiImpresaGiornalieri,
  seedCassaImpresaSeMancante,
  aggiungiIncassoImpresa,
  pagaFissoEDistribuisciTipBar
} from "../game/impresaCassa";
import { provaAssumiPrimoArrivoComeBaristaSeVuoto } from "../game/barEconomia";
import {
  getCastaAbitante,
  applicaCastaAbitante,
  applicaNobiltàDaMatrimonio
} from "../game/casta";
import { sincronizzaCuginoNobileConRe } from "../game/cuginoNobileAvventura";
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
  getOggettoInventario,
  normalizzaInventarioMensa,
  type VoceInventario
} from "../game/inventario";
import { applicaRaccoltaBoscoGiornaliera, assumiDisoccupatoNelBosco } from "../game/boscoRaccolta";
import {
  ricollocaSeLavoroIrraggiungibile,
  type RisultatoRicollocaLavoro
} from "../game/ricollocaLavoroIrraggiungibile";
import type { EdificioInCellaLike } from "../game/commutePathsMappa";
import {
  applicaRaccoltaMinieraGiornaliera,
  assumiDisoccupatoNellaMiniera
} from "../game/minieraRaccolta";
import { applicaZeccaGiornaliera } from "../game/zeccaProduzione";
import { serviPastoMensaTransaction, trasferisciCiboGiocatoreAMensaPuro } from "../game/mensaPubblica";
import {
  getGiornoGiocoSnapshot,
  getOrologioGiocoVelocitaSnapshot,
  getOrologioPersistableSnapshot,
  msRealiPerMinutoGioco,
  restoreOrologioGioco,
  setOrologioGiocoBloccatoDallaFase,
  subscribeGiornoGioco,
  subscribeOraGioco,
  subscribeOrologioGiocoVelocita,
  syncOrologioGiocoDaWallClock
} from "../game/orologioGiocoSession";
import {
  isColturaSerraValida,
  scegliColturaSerraCasuale,
  tutteColtureSerraSbloccate,
  normalizzaColtureSerraSbloccate,
  COLTURA_SERRA_DEFAULT
} from "../game/colturaSerra";
import {
  applicaProduzioneSerraGiornaliera
} from "../game/produzioneSerra";
import {
  haLuogoCulto,
  TEMPLATE_ID_LUOGO_CULTO,
  trovaCapoReligiosoSenzaLuogo,
  type ReligioneConCulto
} from "../game/luogoCulto";
import { assicuraReligioneTempioChiese } from "../game/chiesa";
import {
  normalizzaReligioniCustom,
  provaCreaReligioneCustom,
  puoDiventareFedeleCulto,
  type ReligioneCustom
} from "../game/fedeleCulto";
import { creaRichiestaLuogoCulto, type RichiestaInAttesa } from "../game/richieste";
import { isSimulationRunning, type GamePhase } from "../game/gamePhase";
import type { PersistableGameState } from "../persistence/gameStateMapping";
import type { MappaRuntimeState } from "../game/mappaTypes";
import { setMappaSessione, getMappaSessione } from "../game/mappaSessione";
import { resetMappaPersonaggiRuntime } from "../game/mappaPersonaggiRuntimeStore";
import { azzeraReUscitaCastelloPending, impostaUscitaCastelloInizioPartita } from "../game/reUscitaCastelloPending";
import { mappaHaPonteOperativo } from "../game/ponteMappa";
import {
  nominaConsigliere as nominaConsiglierePuro
} from "../game/consigliere";

const statoIniziale = generaColoniaIniziale();
const capoReligiosoSoleIniziale =
  statoIniziale.abitanti.find(
    (a) =>
      (a.lavoro === "Capo Spirituale" || a.lavoro === "Capo Religioso") &&
      a.religione === "Culto del Sole"
  )?.id ?? null;

const NOMI_EDIFICI_AVVENTURA = new Set([
  "Castello",
  "Serra",
  "Capanna",
  "Porto",
  "Bosco",
  "Miniera",
  "Zecca",
  "Emporio",
  "Ufficio Edile",
  "Chiesa"
]);

function creaEdificiIniziali(
  abitantiIniziali: Abitante[],
  modalita: ModalitaGiocoGenerazione = "creativa",
  colturaSerraIniziale?: string
): Edificio[] {
  const tuttiId = abitantiIniziali.map((a) => a.id);
  const baraccaIds = abitantiIniziali.filter((a) => a.fazioni?.includes("Senzatetto")).map((a) => a.id);
  const dormitorioIds: number[] = [];
  const agricoltore = abitantiIniziali.find((a) => a.lavoro === "Agricoltore");
  const serraIds = agricoltore ? [agricoltore.id] : [];
  const ediliIds = abitantiIniziali.filter((a) => a.lavoro === "Edile").map((a) => a.id);
  const minatoriIds = abitantiIniziali.filter((a) => a.lavoro === "Minatore").map((a) => a.id);
  const monetieriIds = abitantiIniziali.filter((a) => a.lavoro === "Monetiere").map((a) => a.id);
  const prigionieriIds = abitantiIniziali.filter((a) => a.lavoro === "Prigioniero").map((a) => a.id);
  const cleroIds = abitantiIniziali
    .filter(
      (a) =>
        a.lavoro === "Sacerdote" ||
        a.lavoro === "Capo Spirituale" ||
        a.lavoro === "Capo Religioso" ||
        a.casta === "Clero"
    )
    .map((a) => a.id);
  const consigliereIds = abitantiIniziali.filter((a) => a.lavoro === "Consigliere").map((a) => a.id);
  const nobileIds = abitantiIniziali
    .filter((a) => getCastaAbitante(a) === "Nobile")
    .map((a) => a.id);
  const castelloResidentiIds = [
    ...new Set([ID_GIOCATORE, ...consigliereIds, ...nobileIds])
  ];
  const castelloSet = new Set(castelloResidentiIds);
  const cleroSet = new Set(cleroIds);
  const capannaIds = tuttiId.filter(
    (id) => !baraccaIds.includes(id) && !castelloSet.has(id) && !cleroSet.has(id)
  );
  return edificiData
    .filter((e) => e.tipo !== "Luogo di Culto")
    .filter((e) => e.nome !== "Acquedotto" && e.nome !== "Dissalatore")
    .filter((e) => e.nome !== "Ponte")
    .filter((e) => {
      if (modalita !== "avventura") return true;
      // Una sola Serra in Avventura (id 2); niente catalogo “fantasma” Operativo.
      if (e.nome === "Serra") return e.id === 2;
      return NOMI_EDIFICI_AVVENTURA.has(e.nome);
    })
    .map((e) => {
      let next: Edificio = e;
      if (e.id === 4) next = { ...e, abitantiAssegnati: baraccaIds, occupazione: baraccaIds.length };
      else if (e.id === 14) next = { ...e, abitantiAssegnati: dormitorioIds, occupazione: dormitorioIds.length };
      else if (e.id === 2)
        next = {
          ...e,
          abitantiAssegnati: serraIds,
          occupazione: serraIds.length,
          ...(colturaSerraIniziale && isColturaSerraValida(colturaSerraIniziale)
            ? { colturaItemId: colturaSerraIniziale }
            : {})
        };
      else if (e.id === 21) next = { ...e, abitantiAssegnati: [], occupazione: 0 };
      else if (e.id === 3) next = { ...e, abitantiAssegnati: minatoriIds, occupazione: minatoriIds.length };
      else if (e.id === 52) next = { ...e, abitantiAssegnati: monetieriIds, occupazione: monetieriIds.length };
      else if (e.id === 33)
        next = { ...e, abitantiAssegnati: ediliIds, occupazione: ediliIds.length };
      else if (e.id === 9) next = { ...e, abitantiAssegnati: prigionieriIds, occupazione: prigionieriIds.length };
      else if (e.id === 46)
        next = {
          ...e,
          abitantiAssegnati: cleroIds,
          occupazione: cleroIds.length,
          religioneTempio: "Culto del Sole"
        };
      else if (e.id === 20) next = { ...e, abitantiAssegnati: capannaIds, occupazione: capannaIds.length };
      else if (e.id === 1)
        next = {
          ...e,
          abitantiAssegnati: castelloResidentiIds,
          occupazione: castelloResidentiIds.length
        };
      // Attività iniziali con posti lavoro: stipendio base 1 moneta/giorno (30/mese).
      if (
        next.stipendioPerLavoratore == null &&
        isEdificioPubblicoConPostazioniLavoro({ ...next, stato: "Operativo" })
      ) {
        next = { ...next, stipendioPerLavoratore: STIPENDIO_BASE_MONETE_MESE };
      }
      next = seedCassaImpresaSeMancante(next);
      return next;
    });
}

const edificiIniziali = creaEdificiIniziali(statoIniziale.abitanti, "creativa");

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
  const [inventarioEmporioByEdificioId, setInventarioEmporioByEdificioId] = useState<
    Record<number, VoceInventario[]>
  >({});
  const inventarioGiocatoreRef = useRef(inventarioGiocatore);
  const inventarioMensaRef = useRef(inventarioMensaByEdificioId);
  const inventarioEmporioRef = useRef(inventarioEmporioByEdificioId);
  const moneteGiocatoreRef = useRef(moneteGiocatore);
  const abitantiRef = useRef(abitanti);
  inventarioGiocatoreRef.current = inventarioGiocatore;
  inventarioMensaRef.current = inventarioMensaByEdificioId;
  inventarioEmporioRef.current = inventarioEmporioByEdificioId;
  moneteGiocatoreRef.current = moneteGiocatore;
  abitantiRef.current = abitanti;
  const [risorse, setRisorse] = useState<Risorsa[]>(() => estraiCreditiLegacyDaRisorse(risorseData).risorse);
  const risorseRef = useRef(risorse);
  risorseRef.current = risorse;
  const [edifici, setEdifici] = useState<Edificio[]>(edificiIniziali);
  const edificiRef = useRef(edifici);
  edificiRef.current = edifici;
  const ultimoGiornoProduzioneSerraRef = useRef(getGiornoGiocoSnapshot());
  const ultimoGiornoEconomiaPubblicaRef = useRef(getGiornoGiocoSnapshot());
  const ultimoGiornoRaccoltaBoscoRef = useRef(getGiornoGiocoSnapshot());
  const ultimoGiornoRaccoltaMinieraRef = useRef(getGiornoGiocoSnapshot());
  const ultimoGiornoPastiRef = useRef(0);
  const avanzaMeseInCorsoRef = useRef(false);
  const ultimoIndiceMeseProcessatoRef = useRef(
    Math.floor((getGiornoGiocoSnapshot() - 1) / GIORNI_MESE_ECONOMIA)
  );
  const modalitaReRef = useRef<ModalitaRe>(STATO_RE_DEFAULT.modalitaRe);
  const edificioVisitaReIdRef = useRef<number | null>(null);
  const [mese, setMese] = useState(1);
  const [anno, setAnno] = useState(0);
  const meseRef = useRef(mese);
  const annoRef = useRef(anno);
  meseRef.current = mese;
  annoRef.current = anno;
  const [isLoading, setIsLoading] = useState(false);
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
  const [registrazioniScambi, setRegistrazioniScambi] = useState<RegistrazioneScambio[]>([]);

  const registraScambioCommerciale = useCallback(
    (voce: Omit<RegistrazioneScambio, "id" | "giorno" | "minutiDaMezzanotte"> & { id?: string }) => {
      const clock = getOrologioPersistableSnapshot();
      const id =
        voce.id ??
        `${clock.giorno}-${clock.minutiDaMezzanotte}-${voce.luogoNome}-${voce.daId ?? "r"}-${voce.aId ?? "r"}-${voce.itemId}-${Date.now()}`;
      setRegistrazioniScambi((prev) =>
        appendRegistrazioneScambio(prev, {
          ...voce,
          id,
          giorno: clock.giorno,
          minutiDaMezzanotte: clock.minutiDaMezzanotte
        })
      );
    },
    []
  );

  /** Soddisfazione 1-100 per fazioni tracciate (Rivoluzionari, Sicurezza). Partono a 80. */
  const [soddisfazioneFazioni, setSoddisfazioneFazioni] = useState<Record<string, number>>(() => ({
    Rivoluzionari: 80,
    Sicurezza: 80
  }));
  const [modalitaRe, setModalitaReState] = useState<ModalitaRe>(STATO_RE_DEFAULT.modalitaRe);
  const [edificioVisitaReId, setEdificioVisitaReId] = useState<number | null>(null);
  const [popolaritaRe, setPopolaritaRe] = useState(STATO_RE_DEFAULT.popolaritaRe);
  const [mesiConsecutiviNelCastello, setMesiConsecutiviNelCastello] = useState(0);
  const [faseDisordine, setFaseDisordine] = useState<FaseDisordine>("nessuna");
  const [avvisoReAssenteEmesso, setAvvisoReAssenteEmesso] = useState(false);
  const [obiettiviCompletati, setObiettiviCompletati] = useState<string[]>([]);
  const [coltureSerraSbloccate, setColtureSerraSbloccate] = useState<string[]>(() =>
    tutteColtureSerraSbloccate()
  );
  const [modalitaGioco, setModalitaGioco] = useState<"creativa" | "avventura">("avventura");
  modalitaReRef.current = modalitaRe;
  edificioVisitaReIdRef.current = edificioVisitaReId;
  const modificaSoddisfazioneFazione = useCallback((fazione: string, delta: number) => {
    setSoddisfazioneFazioni((prev) => ({
      ...prev,
      [fazione]: Math.max(1, Math.min(100, (prev[fazione] ?? 80) + delta))
    }));
  }, []);

  const setModalitaRe = useCallback((modalita: ModalitaRe, edificioId?: number | null) => {
    setModalitaReState((prevMod) => {
      const next = setModalitaRePuro(
        {
          modalitaRe: prevMod,
          edificioVisitaReId,
          popolaritaRe,
          mesiConsecutiviNelCastello,
          faseDisordine,
          avvisoReAssenteEmesso
        },
        modalita,
        edificioId
      );
      setEdificioVisitaReId(next.edificioVisitaReId);
      return next.modalitaRe;
    });
  }, [edificioVisitaReId, popolaritaRe, mesiConsecutiviNelCastello, faseDisordine, avvisoReAssenteEmesso]);

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
        inventarioEmporioRef.current,
        giorno,
        ultimo
      );
      ultimoGiornoPastiRef.current = giorno;

      setAbitanti(result.abitanti);
      setEdifici(result.edifici);
      setInventarioMensaByEdificioId(result.inventarioMensaByEdificioId);
      setInventarioEmporioByEdificioId(result.inventarioEmporioByEdificioId);
      if (result.carestiaMensa) {
        setEventiInCorso((prev) => attivaEventoCarestia(prev, meseRef.current, annoRef.current));
      }
    };

    applicaPasti();
    const unsub = subscribeGiornoGioco(applicaPasti);
    return unsub;
  }, []);

  /**
   * Driver orologio globale: fa avanzare minuti/ore anche fuori dalla mappa.
   * I cantieri avanzano su {@link subscribeOraGioco}.
   */
  useEffect(() => {
    let velocita = getOrologioGiocoVelocitaSnapshot();
    let timer: ReturnType<typeof setInterval> | null = null;
    const arm = () => {
      if (timer) clearInterval(timer);
      const tickMs = Math.max(50, Math.floor(msRealiPerMinutoGioco(velocita) / 2));
      timer = setInterval(() => {
        if (!isSimulationRunning(gamePhaseRef.current)) return;
        syncOrologioGiocoDaWallClock();
      }, tickMs);
    };
    arm();
    const unsubVel = subscribeOrologioGiocoVelocita(() => {
      velocita = getOrologioGiocoVelocitaSnapshot();
      arm();
    });
    return () => {
      unsubVel();
      if (timer) clearInterval(timer);
    };
  }, []);

  /** Cantieri: +1 progresso / ora / Edile sul cantiere attivo. */
  useEffect(() => {
    return subscribeOraGioco((orePassate) => {
      if (!isSimulationRunning(gamePhaseRef.current)) return;
      const result = avanzaCostruzioniEdifici(edificiRef.current, abitantiRef.current, orePassate);
      if (result.edifici === edificiRef.current) return;
      setEdifici(result.edifici);
      if (result.completati.length > 0) {
        const msg = result.completati.map((c) => `${c.nome} è stato completato.`).join(" ");
        setDiarioRighe((prev) => [...prev, msg]);
        Alert.alert(
          result.completati.length === 1 ? "Cantiere completato" : "Cantieri completati",
          msg
        );
      }
    });
  }, []);

  /** Serra: ogni Agricoltore produce 1 unità/giorno della coltura → inventario + Registrazioni. */
  useEffect(() => {
    const applicaProduzioneSerra = () => {
      if (!isSimulationRunning(gamePhaseRef.current)) return;
      const giorno = getGiornoGiocoSnapshot();
      const ultimo = ultimoGiornoProduzioneSerraRef.current;
      if (giorno <= ultimo) return;
      const giorni = giorno - ultimo;
      ultimoGiornoProduzioneSerraRef.current = giorno;
      const buffId = edificioBuffVisitaCorrente(
        { modalitaRe: modalitaReRef.current, edificioVisitaReId: edificioVisitaReIdRef.current },
        edificiRef.current
      );
      const result = applicaProduzioneSerraGiornaliera(
        abitantiRef.current,
        edificiRef.current,
        giorno,
        giorni,
        buffId
      );
      if (result.abitanti !== abitantiRef.current) setAbitanti(result.abitanti);
      if (result.messaggi.length > 0) {
        setDiarioRighe((prev) => [...prev, ...result.messaggi]);
      }
      for (const bottino of result.bottini) {
        for (const v of bottino.voci) {
          registraScambioCommerciale(
            voceRegistrazioneRaccoltaSerra({
              abitanteId: bottino.abitanteId,
              abitanteNome: bottino.abitanteNome,
              serraId: bottino.serraId,
              itemId: v.itemId,
              itemNome: v.nome,
              itemEmoji: v.emoji,
              quantità: v.quantità
            })
          );
        }
      }
    };
    const unsub = subscribeGiornoGioco(applicaProduzioneSerra);
    return unsub;
  }, [registraScambioCommerciale]);

  /** Bosco: ogni Raccoglitore trova 1 oggetto casuale al giorno nel proprio inventario. */
  useEffect(() => {
    const applicaProduzioneBosco = () => {
      if (!isSimulationRunning(gamePhaseRef.current)) return;
      const giorno = getGiornoGiocoSnapshot();
      const ultimo = ultimoGiornoRaccoltaBoscoRef.current;
      if (giorno <= ultimo) return;
      const giorni = giorno - ultimo;
      ultimoGiornoRaccoltaBoscoRef.current = giorno;
      const result = applicaRaccoltaBoscoGiornaliera(abitantiRef.current, edificiRef.current, giorno, giorni);
      if (result.abitanti !== abitantiRef.current) setAbitanti(result.abitanti);
      if (result.messaggi.length > 0) {
        setDiarioRighe((prev) => [...prev, ...result.messaggi]);
      }
      for (const bottino of result.bottini) {
        for (const v of bottino.voci) {
          registraScambioCommerciale(
            voceRegistrazioneRaccoltaBosco({
              abitanteId: bottino.abitanteId,
              abitanteNome: bottino.abitanteNome,
              boscoId: bottino.boscoId,
              itemId: v.itemId,
              itemNome: v.nome,
              itemEmoji: v.emoji,
              quantità: v.quantità
            })
          );
        }
      }
    };
    const unsub = subscribeGiornoGioco(applicaProduzioneBosco);
    return unsub;
  }, [registraScambioCommerciale]);

  /** Miniera: bottino inventario + deposito Metalli/Materiale Edile (come Bosco). */
  useEffect(() => {
    const applicaProduzioneMiniera = () => {
      if (!isSimulationRunning(gamePhaseRef.current)) return;
      const giorno = getGiornoGiocoSnapshot();
      const ultimo = ultimoGiornoRaccoltaMinieraRef.current;
      if (giorno <= ultimo) return;
      const giorni = giorno - ultimo;
      ultimoGiornoRaccoltaMinieraRef.current = giorno;
      const result = applicaRaccoltaMinieraGiornaliera(
        abitantiRef.current,
        edificiRef.current,
        risorseRef.current,
        giorno,
        giorni
      );
      if (result.abitanti !== abitantiRef.current) setAbitanti(result.abitanti);
      if (result.risorse !== risorseRef.current) setRisorse(result.risorse);
      if (result.messaggi.length > 0) {
        setDiarioRighe((prev) => [...prev, ...result.messaggi]);
      }
      for (const bottino of result.bottini) {
        for (const v of bottino.voci) {
          registraScambioCommerciale(
            voceRegistrazioneRaccoltaMiniera({
              abitanteId: bottino.abitanteId,
              abitanteNome: bottino.abitanteNome,
              minieraId: bottino.minieraId,
              itemId: v.itemId,
              itemNome: v.nome,
              itemEmoji: v.emoji,
              quantità: v.quantità
            })
          );
        }
      }
    };
    const unsub = subscribeGiornoGioco(applicaProduzioneMiniera);
    return unsub;
  }, [registraScambioCommerciale]);

  /** All’avvio: i cittadini disoccupati prendono subito i posti vacanti (Bar, Serra, …). */
  useEffect(() => {
    if (!simulationEnabled) return;
    let edificiNext = autoAssegnaCittadiniDisoccupati(abitantiRef.current, edificiRef.current);
    const norm = normalizzaLavoroEAgricoltura(abitantiRef.current, edificiNext);
    setEdifici(norm.edifici);
    if (norm.abitanti !== abitantiRef.current) setAbitanti(norm.abitanti);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo bootstrap partita
  }, [simulationEnabled]);

  /** Cittadini disoccupati cercano lavoro; stipendi pubblici dal tesoro e imprese dalla cassa. */
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
      abitantiNext = pagato.abitanti;

      const imprese = pagaStipendiImpresaGiornalieri(abitantiNext, edificiNext, giorni);
      abitantiNext = imprese.abitanti;
      edificiNext = imprese.edifici;

      const zecca = applicaZeccaGiornaliera(
        risorseRef.current,
        edificiNext,
        pagato.moneteGiocatore,
        giorni
      );
      if (zecca.moneteConiate > 0) {
        setRisorse(zecca.risorse);
        setDiarioRighe((prev) => [
          ...prev,
          `La Zecca ha coniato ${zecca.moneteConiate} monete per il Tesoro.`
        ]);
      }

      setMoneteGiocatore(zecca.moneteGiocatore);
      setAbitanti(abitantiNext);
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
  const [religioneDiStato, setReligioneDiStato] = useState<"Ateo" | "Deista" | "Agnostico" | "Culto del Sole" | "Culto delle Ombre" | string | null>(null);
  const [religioniCustom, setReligioniCustom] = useState<ReligioneCustom[]>([]);
  
  // Capo religioso e fedeli per ogni culto
  const [capoReligiosoSole, setCapoReligiosoSoleState] = useState<number | null>(capoReligiosoSoleIniziale);
  const [capoReligiosoAlieni, setCapoReligiosoAlieniState] = useState<number | null>(null);
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

  /** Nomina Capo: Ateo/Deista non possono diventare Fedeli. */
  const setCapoReligiosoSole = useCallback(
    (id: number | null) => {
      if (id != null) {
        const a = abitanti.find((x) => x.id === id);
        if (a && !puoDiventareFedeleCulto(a)) return;
      }
      setCapoReligiosoSoleState(id);
    },
    [abitanti]
  );
  const setCapoReligiosoAlieni = useCallback(
    (id: number | null) => {
      if (id != null) {
        const a = abitanti.find((x) => x.id === id);
        if (a && !puoDiventareFedeleCulto(a)) return;
      }
      setCapoReligiosoAlieniState(id);
    },
    [abitanti]
  );

  // Sincronizza lavoro «Capo Spirituale» (Clero) con la nomina nei culti.
  // Ateo/Deista non possono diventare Fedeli: non forzare la religione culto su di loro.
  useEffect(() => {
    if (!simulationEnabled) return;
    setAbitanti((prev) =>
      prev.map((a) => {
        if (capoReligiosoSole != null && a.id === capoReligiosoSole) {
          if (!puoDiventareFedeleCulto(a) && a.religione !== "Culto del Sole") {
            return a;
          }
          const aspetto = aspettoCapoReligiosoSeNecessario(a.aspetto, a.id);
          return {
            ...a,
            lavoro: "Capo Spirituale",
            casta: "Clero",
            religione: "Culto del Sole" as const,
            crediti: 0,
            spese: 0,
            reddito: 0,
            ...(aspetto && { aspetto })
          };
        }
        if (capoReligiosoAlieni != null && a.id === capoReligiosoAlieni) {
          if (!puoDiventareFedeleCulto(a) && a.religione !== "Culto delle Ombre") {
            return a;
          }
          const aspetto = aspettoCapoReligiosoSeNecessario(a.aspetto, a.id);
          return {
            ...a,
            lavoro: "Capo Spirituale",
            casta: "Clero",
            religione: "Culto delle Ombre" as const,
            crediti: 0,
            spese: 0,
            reddito: 0,
            ...(aspetto && { aspetto })
          };
        }
        if (a.lavoro === "Capo Spirituale" || a.lavoro === "Capo Religioso") {
          if (a.religione === "Culto del Sole" && a.id !== capoReligiosoSole) {
            return { ...a, lavoro: "Sacerdote", casta: "Clero", reddito: 0 };
          }
          if (a.religione === "Culto delle Ombre" && a.id !== capoReligiosoAlieni) {
            return { ...a, lavoro: "Sacerdote", casta: "Clero", reddito: 0 };
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

  // Richiesta Luogo di Culto: non parte più in automatico a inizio partita.
  // Si attiverà in seguito (es. dopo un obiettivo); per ora resta solo il flusso manuale/rimandato.

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
  const [nudismoAttivo, setNudismoAttivo] = useState(false);
  
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

  /** Prezzo mensile (monete) impostato dall'utente per ogni tipo di residenza. Default dal catalogo se non impostato. */
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

  const avanzaMese = useCallback(async () => {
    if (!isSimulationRunning(gamePhaseRef.current)) return;
    if (avanzaMeseInCorsoRef.current) return;
    avanzaMeseInCorsoRef.current = true;
    setIsLoading(true);

    try {
      const buffId = edificioBuffVisitaCorrente(
        { modalitaRe, edificioVisitaReId },
        edifici
      );

      const tasseUnlock = tasseSbloccate(obiettiviCompletati, modalitaGioco);

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
        moneteGiocatore,
        edificioBuffVisitaId: buffId,
        configTassaReddito: tasseUnlock.has("reddito")
          ? {
              tipo: tipoTassaReddito,
              flatPercentuale: flatTaxPercentuale,
              scaglioni: scaglioniConfig
            }
          : {
              tipo: "flat",
              flatPercentuale: 0,
              scaglioni: [{ min: 0, max: Infinity, percentuale: 0 }]
            },
        tassaPatrimonioPercentuale: tasseUnlock.has("patrimonio") ? tassaPatrimonioPercentuale : 0,
        ivaPercentuale: tasseUnlock.has("iva") ? ivaPercentuale : 0
      });

      setNativiNonIntegrati((prev) => prev + result.deltaNativiNonIntegrati);
      if (result.pendingAssimilazione != null) setPendingAssimilazione(result.pendingAssimilazione);
      if (result.pendingMatrimonio != null) setPendingMatrimonio(result.pendingMatrimonio);
      if (result.newIdNascita != null) setNextId(result.newIdNascita + 1);
      setEventiInCorso(result.eventiInCorso);
      const dopoCarcere = avanzaCarcereResiduoPuro(result.abitanti, result.edifici);

      const giorno = getGiornoGiocoSnapshot();
      const statoReCorrente: StatoRePolitica = {
        modalitaRe,
        edificioVisitaReId,
        popolaritaRe,
        mesiConsecutiviNelCastello,
        faseDisordine,
        avvisoReAssenteEmesso
      };

      // Disordine della fase in corso (prima del tick modalità)
      const effettiDisordine = applicaEffettiDisordineMensile(
        faseDisordine,
        result.moneteGiocatore,
        dopoCarcere.abitanti,
        dopoCarcere.edifici
      );
      let abitantiDopo = effettiDisordine.abitanti;
      let edificiDopo = effettiDisordine.edifici;
      let moneteDopo = effettiDisordine.moneteGiocatore;
      let popDopo = applicaPopolaritaDelta(popolaritaRe, effettiDisordine.popolaritaDelta);

      const attentato = tentaAttentatoAlRe({
        abitanti: abitantiDopo,
        edifici: edificiDopo,
        modalitaRe,
        giornoGioco: giorno,
        mese: result.nuovoMese,
        anno: result.nuovoAnno
      });
      abitantiDopo = attentato.abitanti;
      if (attentato.esito.tipo === "mortale") {
        edificiDopo = edificiDopo.map((e) => {
          const nuovi = (e.abitantiAssegnati ?? []).filter((id) => id !== ID_GIOCATORE);
          return nuovi.length !== (e.abitantiAssegnati?.length ?? 0)
            ? { ...e, abitantiAssegnati: nuovi, occupazione: nuovi.length }
            : e;
        });
      }

      const tickRe = tickModalitaReMensile(
        { ...statoReCorrente, popolaritaRe: popDopo },
        edificiDopo
      );
      setModalitaReState(tickRe.stato.modalitaRe);
      setEdificioVisitaReId(tickRe.stato.edificioVisitaReId);
      setPopolaritaRe(tickRe.stato.popolaritaRe);
      setMesiConsecutiviNelCastello(tickRe.stato.mesiConsecutiviNelCastello);
      setAvvisoReAssenteEmesso(tickRe.stato.avvisoReAssenteEmesso);

      const snapDisordine = valutaFaseDisordine(
        faseDisordine,
        abitantiDopo,
        edificiDopo,
        giorno,
        result.nuovoMese,
        result.nuovoAnno
      );
      setFaseDisordine(snapDisordine.fase);

      setEdifici(edificiDopo);
      setRisorse(estraiCreditiLegacyDaRisorse(result.risorse).risorse);
      setMoneteGiocatore(moneteDopo);
      setAbitanti(abitantiDopo);
      setMese(result.nuovoMese);
      setAnno(result.nuovoAnno);
      setOrdiniMercato([]);
      generaNuoviAbitantiProposti();

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

      const diarioExtra = [
        result.avvisoDiario,
        tickRe.avvisoDiario,
        ...effettiDisordine.messaggi,
        messaggioFaseDisordine(snapDisordine),
        messaggioEsitoAttentato(attentato.esito)
      ].filter((x): x is string => !!x);
      if (diarioExtra.length > 0) {
        setDiarioRighe((prev) => [...prev, ...diarioExtra]);
      }
      if (attentato.esito.tipo === "ferito" || attentato.esito.tipo === "mortale") {
        Alert.alert("Attentato", messaggioEsitoAttentato(attentato.esito) ?? "Attentato al Re.");
      } else if (attentato.esito.tipo === "sventato") {
        Alert.alert("Attentato sventato", messaggioEsitoAttentato(attentato.esito) ?? "");
      }

      // ── Valutazione obiettivi (solo in modalità Avventura) ──────────────
      if (modalitaGioco === "avventura") {
        const haPonte = mappaHaPonteOperativo(
          getMappaSessione()?.edificiInMappa ?? {},
          edificiDopo
        );
        setObiettiviCompletati((prevCompletati) => {
          const completatiSet = new Set(prevCompletati);
          const sbloccati = obiettiviSbloccati(completatiSet);
          let aggiornato = false;
          let sbloccaColture = false;
          for (const id of sbloccati) {
            if (completatiSet.has(id)) continue;
            const nodo = OBIETTIVI_CATALOGO.find((o) => o.id === id);
            if (!nodo) continue;
            const soddisfatto = nodo.condizione({
              abitanti: abitantiDopo,
              edifici: edificiDopo,
              risorse: estraiCreditiLegacyDaRisorse(result.risorse).risorse,
              mese: result.nuovoMese,
              anno: result.nuovoAnno,
              moneteGiocatore: moneteDopo,
              completati: completatiSet,
              haPonteSulFiume: haPonte
            });
            if (soddisfatto) {
              completatiSet.add(id);
              aggiornato = true;
              if (nodo.sblocca?.tipo === "colture_serra") sbloccaColture = true;
            }
          }
          if (sbloccaColture) {
            setColtureSerraSbloccate(tutteColtureSerraSbloccate());
          }
          return aggiornato ? [...completatiSet] : prevCompletati;
        });
      }
    } finally {
      setIsLoading(false);
      avanzaMeseInCorsoRef.current = false;
    }
  }, [abitanti, edifici, risorse, ordiniMercato, eventiInCorso, punteggioSanzioni, mese, anno, generaNuoviAbitantiProposti, divietoEspatrioAttivo, calcolaFelicitàModificata, politicaNascite, nextId, etaPensionabile, assegnoPensionati, soddisfazioneFazioni, prezzoResidenze, redditoCittadinanza, modalitaSanita, tipologieFamigliaAccettate, moneteGiocatore, modalitaRe, edificioVisitaReId, popolaritaRe, mesiConsecutiviNelCastello, faseDisordine, avvisoReAssenteEmesso, modalitaGioco, tipoTassaReddito, flatTaxPercentuale, scaglioniConfig, tassaPatrimonioPercentuale, ivaPercentuale, obiettiviCompletati]);

  const avanzaMeseRef = useRef(avanzaMese);
  avanzaMeseRef.current = avanzaMese;

  /** Cambio mese automatico ogni 30 giorni di gioco (niente salto mese manuale). */
  useEffect(() => {
    const onGiorno = () => {
      if (!isSimulationRunning(gamePhaseRef.current)) return;
      const giorno = getGiornoGiocoSnapshot();
      const idx = Math.floor((giorno - 1) / GIORNI_MESE_ECONOMIA);
      if (idx <= ultimoIndiceMeseProcessatoRef.current) return;
      ultimoIndiceMeseProcessatoRef.current = idx;
      void avanzaMeseRef.current();
    };
    const unsub = subscribeGiornoGioco(onGiorno);
    return unsub;
  }, []);

  const confermaMatrimonio = useCallback((idA: number, idB: number) => {
    setAbitanti((prev) => {
      const a = prev.find((x) => x.id === idA);
      const b = prev.find((x) => x.id === idB);
      if (!a || !b) return prev;
      const [nobA, nobB] = applicaNobiltàDaMatrimonio(a, b);
      return prev.map((x) => {
        if (x.id === idA) return { ...nobA, coniugeId: idB };
        if (x.id === idB) return { ...nobB, coniugeId: idA };
        return x;
      });
    });
    setPendingMatrimonio(null);
  }, []);

  const setCastaAbitante = useCallback(
    (abitanteId: number, casta: Casta, schiavistaId?: number | null) => {
      if (abitanteId === ID_GIOCATORE) return;
      setAbitanti((prev) => {
        const target = prev.find((a) => a.id === abitanteId);
        if (!target) return prev;
        let padrone = schiavistaId;
        if (casta === "Schiavo" && padrone == null) {
          const nobilePadrone = prev.find(
            (a) => a.id !== abitanteId && getCastaAbitante(a) === "Nobile"
          );
          padrone = nobilePadrone?.id ?? null;
        }
        const aggiornato = applicaCastaAbitante(target, casta, {
          schiavistaId: casta === "Schiavo" ? padrone : undefined
        });
        return prev.map((a) => (a.id === abitanteId ? aggiornato : a));
      });
    },
    []
  );

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
  const [introConsigliereAperta, setIntroConsigliereAperta] = useState(false);
  const [introConsigliereVisto, setIntroConsigliereVisto] = useState(false);
  const [suggerimentoPonteAperto, setSuggerimentoPonteAperto] = useState(false);
  const [dialogPiazzaPonteAperto, setDialogPiazzaPonteAperto] = useState(false);
  const modalitaGiocoRef = useRef<"creativa" | "avventura">(modalitaGioco);
  modalitaGiocoRef.current = modalitaGioco;

  /** Avvia post-creazione: in Avventura apre il Consigliere; in Creativa salta all'attivazione. Estendere qui future azioni per modalità. */
  const avviaDopoCreazioneGiocatore = useCallback(() => {
    setCreazioneGiocatoreAperta(false);
    if (modalitaGiocoRef.current === "avventura") {
      setIntroConsigliereAperta(true);
      return;
    }
    setIntroConsigliereAperta(false);
    setSuggerimentoPonteAperto(false);
    setDialogPiazzaPonteAperto(false);
    setIntroConsigliereVisto(true);
    setDiarioInizioVisto(true);
    gamePhaseRef.current = "activating";
    setGamePhase("activating");
  }, []);

  const startNewGame = useCallback((modalita: "creativa" | "avventura" = "avventura") => {
    const colonia = generaColoniaIniziale(modalita);
    const colturaIniziale =
      modalita === "creativa" ? COLTURA_SERRA_DEFAULT : scegliColturaSerraCasuale();
    const coltureSbloccate =
      modalita === "creativa" ? tutteColtureSerraSbloccate() : [colturaIniziale];
    const nuoviEdifici = creaEdificiIniziali(colonia.abitanti, modalita, colturaIniziale);
    const capoSole =
      colonia.abitanti.find(
        (a) =>
          (a.lavoro === "Capo Spirituale" || a.lavoro === "Capo Religioso") &&
          a.religione === "Culto del Sole"
      )?.id ??
      null;
    const emporio = nuoviEdifici.find((e) => e.nome === "Emporio" && e.stato === "Operativo");

    setModalitaGioco(modalita);
    modalitaGiocoRef.current = modalita;
    setAbitanti(colonia.abitanti);
    setRazzaNativi(colonia.razzaNativi);
    setEdifici(nuoviEdifici);
    setNextId(colonia.abitanti.length + 100);
    setInventarioGiocatore(creaInventarioGiocatoreIniziale());
    setMoneteGiocatore(creaMoneteGiocatoreIniziali());
    setInventarioMensaByEdificioId({});
    setInventarioEmporioByEdificioId(
      emporio
        ? { [emporio.id]: creaInventarioEmporioIniziale(colturaIniziale) }
        : {}
    );
    setColtureSerraSbloccate(coltureSbloccate);
    setRisorse(estraiCreditiLegacyDaRisorse(risorseData).risorse);
    setMese(1);
    setAnno(0);
    setAbitantiProposti([]);
    setOrdiniMercato([]);
    setEventiInCorso([]);
    setNativiNonIntegrati(100 + Math.floor(Math.random() * 101));
    setPendingAssimilazione(null);
    setPendingMatrimonio(null);
    setMessaggioEmigrazione(null);
    setDiarioRighe([]);
    setRegistrazioniScambi([]);
    setSoddisfazioneFazioni({ Rivoluzionari: 80, Sicurezza: 80 });
    setModalitaReState(STATO_RE_DEFAULT.modalitaRe);
    setEdificioVisitaReId(null);
    setPopolaritaRe(STATO_RE_DEFAULT.popolaritaRe);
    setMesiConsecutiviNelCastello(0);
    setFaseDisordine("nessuna");
    setAvvisoReAssenteEmesso(false);
    setObiettiviCompletati([]);
    setReligioneDiStato(null);
    setReligioniCustom([]);
    setCapoReligiosoSoleState(capoSole);
    setCapoReligiosoAlieniState(null);
    setPendingRichiestaLuogoCulto(null);
    setLuoghiCultoPendentiMappa([]);
    setRichiesteInAttesa([]);
    setLuoghiCultoRifiutati([]);
    // A inizio partita tutti escono dal Castello (non da Capanna / altri edifici).
    azzeraReUscitaCastelloPending();
    if (STATO_RE_DEFAULT.modalitaRe === "a_giro") {
      impostaUscitaCastelloInizioPartita();
    }
    // Avventura: 07:00 = inizio orario Edile, così l’edile iniziale risulta già in sede.
    restoreOrologioGioco({
      giorno: 1,
      minutiDaMezzanotte: modalita === "avventura" ? 7 * 60 : 6 * 60,
      pausaManuale: false
    });
    ultimoGiornoPastiRef.current = 0;
    ultimoGiornoProduzioneSerraRef.current = 1;
    ultimoGiornoEconomiaPubblicaRef.current = 1;
    ultimoGiornoRaccoltaBoscoRef.current = 1;
    ultimoGiornoRaccoltaMinieraRef.current = 1;
    ultimoIndiceMeseProcessatoRef.current = 0;
    setMappaSessione(null);
    // Edile/i dell’Ufficio Edile partono già arrivati in Ufficio (poi camminano al cantiere se presente).
    const ufficioEdile = nuoviEdifici.find((e) => e.nome === "Ufficio Edile" && e.stato === "Operativo");
    const ediliIniziali =
      modalita === "avventura" ? (ufficioEdile?.abitantiAssegnati ?? []) : [];
    const lavoroArrivoSeed: Record<number, number> = {};
    if (ufficioEdile) {
      for (const id of ediliIniziali) lavoroArrivoSeed[id] = ufficioEdile.id;
    }
    resetMappaPersonaggiRuntime(
      ediliIniziali.length > 0
        ? {
            lavoroArrivatiIds: ediliIniziali,
            lavoroArrivoEdificioByAbitanteId: lavoroArrivoSeed
          }
        : undefined
    );
    gamePhaseRef.current = "commander-creation";
    setGamePhase("commander-creation");
    setCreazioneGiocatoreAperta(true);
    setIntroConsigliereAperta(false);
    setSuggerimentoPonteAperto(false);
    setDialogPiazzaPonteAperto(false);
    setIntroConsigliereVisto(false);
    setDiarioInizioVisto(false);
  }, []);
  const configuraGiocatore = useCallback(async (dati: DatiCreazioneGiocatore) => {
    const nomeCompleto = [
      capitalizzaNomePersona(dati.nome),
      capitalizzaNomePersona(dati.cognome)
    ]
      .filter(Boolean)
      .join(" ");
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
    // Attendi warm sprite Consigliere (Avventura) prima di chiudere la creazione.
    if (modalitaGiocoRef.current === "avventura") {
      const cons = abitantiRef.current.find((a) => a.lavoro === "Consigliere");
      if (cons) {
        try {
          const { warmAbitanteVisualAssets } = await import("../game/warmStartupCharacters");
          await warmAbitanteVisualAssets(cons);
        } catch {
          /* ok */
        }
      }
    }
    avviaDopoCreazioneGiocatore();
  }, [avviaDopoCreazioneGiocatore]);
  const chiudiIntroConsigliere = useCallback(() => {
    setIntroConsigliereAperta(false);
    setSuggerimentoPonteAperto(true);
  }, []);
  const chiudiSuggerimentoPonte = useCallback(() => {
    setSuggerimentoPonteAperto(false);
    setIntroConsigliereVisto(true);
    setDiarioInizioVisto(true);
    gamePhaseRef.current = "activating";
    setGamePhase("activating");
  }, []);
  const apriDialogPiazzaPonte = useCallback(() => {
    setDialogPiazzaPonteAperto(true);
  }, []);
  const chiudiDialogPiazzaPonte = useCallback(() => {
    setDialogPiazzaPonteAperto(false);
  }, []);

  const nominaConsigliere = useCallback((abitanteId: number) => {
    const result = nominaConsiglierePuro(abitantiRef.current, edifici, abitanteId);
    if (!result.ok) return;
    setAbitanti(result.abitanti);
    setEdifici(result.edifici);
  }, [edifici]);

  const completaObiettivo = useCallback((obiettivoId: string) => {
    if (modalitaGioco !== "avventura") return;
    setObiettiviCompletati((prev) => (prev.includes(obiettivoId) ? prev : [...prev, obiettivoId]));
    const nodo = OBIETTIVI_CATALOGO.find((o) => o.id === obiettivoId);
    if (nodo?.sblocca?.tipo === "colture_serra") {
      setColtureSerraSbloccate(tutteColtureSerraSbloccate());
    }
  }, [modalitaGioco]);

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
    gamePhaseRef.current = "restoring";
    setGamePhase("restoring");
    setOrologioGiocoBloccatoDallaFase(true);
    setAbitanti(state.abitanti);
    setRazzaNativi(state.razzaNativi);
    setInventarioGiocatore(state.inventarioGiocatore);
    setMoneteGiocatore(state.moneteGiocatore);
    setInventarioMensaByEdificioId(state.inventarioMensaByEdificioId);
    setInventarioEmporioByEdificioId(state.inventarioEmporioByEdificioId ?? {});
    setColtureSerraSbloccate(
      normalizzaColtureSerraSbloccate({
        sbloccate: state.coltureSerraSbloccate,
        modalitaGioco: state.modalitaGioco,
        obiettiviCompletati: state.obiettiviCompletati,
        colturaSerraCorrente: state.edifici.find((e) => e.nome === "Serra")?.colturaItemId
      })
    );
    setRisorse(state.risorse);
    setEdifici(normalizzaEdificiCassaImpresa(state.edifici));
    setMese(state.mese);
    setAnno(state.anno);
    setAbitantiProposti(state.abitantiProposti);
    setNextId(state.nextId);
    setOrdiniMercato(state.ordiniMercato);
    setEventiInCorso(state.eventiInCorso);
    setNativiNonIntegrati(state.nativiNonIntegrati);
    setPendingAssimilazione(state.pendingAssimilazione);
    setPendingMatrimonio(state.pendingMatrimonio);
    setMessaggioEmigrazione(state.messaggioEmigrazione);
    setDiarioRighe(state.diarioRighe);
    {
      const legacy = state.registrazioniEmporio ?? [];
      const scambi = state.registrazioniScambi ?? [];
      if (scambi.length > 0) {
        setRegistrazioniScambi(scambi);
      } else if (legacy.length > 0) {
        setRegistrazioniScambi(legacy.map(migraRegistrazioneEmporioLegacy));
      } else {
        setRegistrazioniScambi([]);
      }
    }
    setSoddisfazioneFazioni(state.soddisfazioneFazioni);
    setModalitaReState(state.modalitaRe ?? STATO_RE_DEFAULT.modalitaRe);
    setEdificioVisitaReId(state.edificioVisitaReId ?? null);
    setPopolaritaRe(state.popolaritaRe ?? STATO_RE_DEFAULT.popolaritaRe);
    setMesiConsecutiviNelCastello(state.mesiConsecutiviNelCastello ?? 0);
    setFaseDisordine(state.faseDisordine ?? "nessuna");
    setAvvisoReAssenteEmesso(state.avvisoReAssenteEmesso ?? false);
    // Caricamento: non far ripartire l’animazione di uscita dal Castello.
    azzeraReUscitaCastelloPending();
    setObiettiviCompletati(state.obiettiviCompletati ?? []);
    setModalitaGioco(state.modalitaGioco ?? "avventura");
    setTipoTassaReddito(state.tipoTassaReddito);
    setFlatTaxPercentuale(state.flatTaxPercentuale);
    setScaglioniConfig(state.scaglioniConfig);
    setTassaPatrimonioPercentuale(
      state.tassaPatrimonioPercentuale ?? TASSA_PATRIMONIO_PERCENTUALE_DEFAULT
    );
    setIvaPercentuale(state.ivaPercentuale ?? IVA_PERCENTUALE_DEFAULT);
    setPoliticaNascite(state.politicaNascite);
    setPunteggioSanzioni(state.punteggioSanzioni);
    setPenaDiMorteAttiva(state.penaDiMorteAttiva);
    setPenaReati(state.penaReati);
    setPoliticaReligiosa(state.politicaReligiosa);
    setReligioneDiStato(state.religioneDiStato);
    setReligioniCustom(normalizzaReligioniCustom(state.religioniCustom));
    setCapoReligiosoSoleState(state.capoReligiosoSole);
    setCapoReligiosoAlieniState(state.capoReligiosoAlieni);
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
    setNudismoAttivo(state.nudismoAttivo);
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
    ultimoIndiceMeseProcessatoRef.current = Math.floor(
      (Math.max(1, state.ultimoGiornoPasti || getGiornoGiocoSnapshot()) - 1) / GIORNI_MESE_ECONOMIA
    );
    restoreOrologioGioco(state);
    resetMappaPersonaggiRuntime();
    setMappaSessione(state.mappa);
    setCreazioneGiocatoreAperta(!state.introductionCompleted);
    setIntroConsigliereAperta(false);
    setSuggerimentoPonteAperto(false);
    setDialogPiazzaPonteAperto(false);
    setIntroConsigliereVisto(state.introConsigliereVisto ?? state.diarioInizioVisto);
    setTimeout(() => setGamePhase(state.introductionCompleted ? "running" : "commander-creation"), 0);
  }, []);

  const createPersistableState = useCallback((mappa: MappaRuntimeState): PersistableGameState => {
    const clock = getOrologioPersistableSnapshot();
    return {
      gamePhase: gamePhase === "running" ? "running" : gamePhase === "activating" ? "activating" : "commander-creation",
      introductionCompleted: diarioInizioVisto,
      diarioInizioVisto,
      introConsigliereVisto,
      abitanti, abitantiProposti, nextId, razzaNativi, nativiNonIntegrati,
      edifici, risorse, inventarioGiocatore, inventarioMensaByEdificioId, inventarioEmporioByEdificioId, moneteGiocatore, prezzoResidenze,
      mese, anno, ...clock,
      ultimoGiornoPasti: ultimoGiornoPastiRef.current,
      ultimoGiornoProduzioneSerra: ultimoGiornoProduzioneSerraRef.current,
      ultimoGiornoEconomiaPubblica: ultimoGiornoEconomiaPubblicaRef.current,
      tipoTassaReddito, flatTaxPercentuale, scaglioniConfig, tassaPatrimonioPercentuale, ivaPercentuale,
      politicaNascite, punteggioSanzioni,
      penaDiMorteAttiva, penaReati, politicaReligiosa, religioneDiStato, religioniCustom, leggeRazzialeAttiva,
      razzaCampoLavoro, razzaCampoSterminio, etaMinimaLavoro, etaPensionabile, assegnoPensionati,
      leggeDroghe, nudismoAttivo, divietoEspatrioAttivo, coprifuocoAttivo, coprifuocoInizioMinuti,
      coprifuocoFineMinuti, iusPrimaeNoctisAttivo, tipologieFamigliaAccettate,
      redditoCittadinanza, modalitaSanita, ordiniMercato, eventiInCorso, soddisfazioneFazioni,
      modalitaRe, edificioVisitaReId, popolaritaRe, mesiConsecutiviNelCastello, faseDisordine, avvisoReAssenteEmesso,
      pendingAssimilazione, pendingMatrimonio, messaggioEmigrazione, diarioRighe,
      registrazioniScambi,
      capoReligiosoSole, capoReligiosoAlieni, pendingRichiestaLuogoCulto, richiesteInAttesa,
      luoghiCultoRifiutati, luoghiCultoPendentiMappa,
      obiettiviCompletati, coltureSerraSbloccate, modalitaGioco, mappa
    };
  }, [gamePhase, diarioInizioVisto, introConsigliereVisto, abitanti, abitantiProposti, nextId, razzaNativi, nativiNonIntegrati,
    edifici, risorse, inventarioGiocatore, inventarioMensaByEdificioId, inventarioEmporioByEdificioId, moneteGiocatore, prezzoResidenze,
    mese, anno, tipoTassaReddito, flatTaxPercentuale, scaglioniConfig, tassaPatrimonioPercentuale, ivaPercentuale,
    politicaNascite, punteggioSanzioni,
    penaDiMorteAttiva, penaReati, politicaReligiosa, religioneDiStato, religioniCustom, leggeRazzialeAttiva,
    razzaCampoLavoro, razzaCampoSterminio, etaMinimaLavoro, etaPensionabile, assegnoPensionati,
    leggeDroghe, nudismoAttivo, divietoEspatrioAttivo, coprifuocoAttivo, coprifuocoInizioMinuti, coprifuocoFineMinuti,
    iusPrimaeNoctisAttivo, tipologieFamigliaAccettate, redditoCittadinanza, modalitaSanita,
    ordiniMercato, eventiInCorso, soddisfazioneFazioni,
    modalitaRe, edificioVisitaReId, popolaritaRe, mesiConsecutiviNelCastello, faseDisordine, avvisoReAssenteEmesso,
    pendingAssimilazione, pendingMatrimonio,
    messaggioEmigrazione, diarioRighe, registrazioniScambi, capoReligiosoSole, capoReligiosoAlieni,
    pendingRichiestaLuogoCulto, richiesteInAttesa, luoghiCultoRifiutati, luoghiCultoPendentiMappa,
    obiettiviCompletati, coltureSerraSbloccate, modalitaGioco]);
  const chiudiMessaggioEmigrazione = useCallback(() => setMessaggioEmigrazione(null), []);

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
    const pieno =
      edificioCorrente.nome === "Castello"
        ? postiLiberiGuardieCastello(edificioCorrente, ID_GIOCATORE, abitanti) <= 0
        : edificioCorrente.abitantiAssegnati.length >= edificioCorrente.capacità;
    if (
      edificioCorrente.abitantiAssegnati.includes(abitanteId) ||
      pieno ||
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

  const setColturaSerra = useCallback(
    (edificioId: number, colturaItemId: string) => {
      if (!isColturaSerraValida(colturaItemId)) return;
      if (
        modalitaGiocoRef.current === "avventura" &&
        !coltureSerraSbloccate.includes(colturaItemId)
      ) {
        return;
      }
      setEdifici((prev) =>
        prev.map((e) =>
          e.id === edificioId && e.nome === "Serra" ? { ...e, colturaItemId } : e
        )
      );
    },
    [coltureSerraSbloccate]
  );

  /** Crea un nuovo edificio nel modello di gioco a partire da una riga del catalogo (nuovo id univoco).
   *  Se `costoMateriale` > 0 e non c'è abbastanza Materiale Edile, restituisce null.
   *  Se `costoMonete` > 0 e il Tesoro non basta, restituisce null.
   *  Di default gli edifici partono «In costruzione» (tranne Ufficio Edile e Capanna). */
  const aggiungiEdificioDaTemplate = useCallback(
    (
      templateId: number,
      options?: { costoMateriale?: number; costoMonete?: number; stato?: Edificio["stato"] }
    ): number | null => {
      const template = edificiData.find((x) => x.id === templateId);
      if (!template) return null;
      const costo = options?.costoMateriale ?? 0;
      const costoMonete = Math.max(0, Math.floor(options?.costoMonete ?? 0));
      if (!haMaterialeEdileSufficiente(risorse, costo)) return null;
      if (costoMonete > 0 && moneteGiocatoreRef.current < costoMonete) return null;

      const stato =
        options?.stato ??
        (edificioParteInCostruzione(template.nome) ? "In costruzione" : "Operativo");

      if (costo > 0) {
        setRisorse((prev) => consumaMaterialeEdile(prev, costo));
      }
      if (costoMonete > 0) {
        setMoneteGiocatore((prev) => Math.max(0, prev - costoMonete));
        moneteGiocatoreRef.current = Math.max(0, moneteGiocatoreRef.current - costoMonete);
        const re = abitantiRef.current.find((a) => a.id === ID_GIOCATORE);
        registraScambioCommerciale(
          voceRegistrazioneCostruzione({
            reId: ID_GIOCATORE,
            reNome: re?.nome?.trim() || "Re",
            itemId: `edificio-${template.id}`,
            itemNome: template.nome,
            itemEmoji: template.emoji ?? "🏗️",
            prezzoMonete: costoMonete
          })
        );
      }
      const createdId =
        Math.max(0, ...edificiRef.current.map((x) => x.id), template.id, 0) + 1;
      const nuovo: Edificio = seedCassaImpresaSeMancante({
        ...template,
        id: createdId,
        abitantiAssegnati: [],
        occupazione: 0,
        stato,
        progressoCostruzione: stato === "In costruzione" ? 0 : undefined,
        stipendioPerLavoratore:
          template.stipendioPerLavoratore ??
          (isEdificioPubblicoConPostazioniLavoro({ ...template, stato: "Operativo" })
            ? STIPENDIO_BASE_MONETE_MESE
            : undefined)
      });
      edificiRef.current = [...edificiRef.current, nuovo];
      setEdifici(edificiRef.current);
      return createdId;
    },
    [risorse, registraScambioCommerciale]
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

  const aggiornaEdificioById = useCallback((edificioId: number, fn: (e: Edificio) => Edificio) => {
    setEdifici((prev) => prev.map((e) => (e.id === edificioId ? fn(e) : e)));
  }, []);

  /** Se il Bar è senza lavoratori, il primo entrante idoneo diventa Barista. */
  const provaAssumiBaristaBarVuotoDaMappa = useCallback(
    (abitanteId: number, barEdificioId: number): boolean => {
      const r = provaAssumiPrimoArrivoComeBaristaSeVuoto(
        abitantiRef.current,
        edificiRef.current,
        abitanteId,
        barEdificioId
      );
      if (!r.assunto) return false;
      setAbitanti(r.abitanti);
      setEdifici(r.edifici);
      return true;
    },
    []
  );

  const incassaImpresa = useCallback((edificioId: number, monete: number) => {
    setEdifici((prev) =>
      prev.map((e) => (e.id === edificioId ? aggiungiIncassoImpresa(e, monete) : e))
    );
  }, []);

  const applicaPagaETipBarFineTurno = useCallback(
    (baristiInServizioByBar: Record<number, number[]>) => {
      setEdifici((prev) =>
        pagaFissoEDistribuisciTipBar(prev, baristiInServizioByBar, (id, fn) => {
          setAbitanti((abs) => abs.map((a) => (a.id === id ? fn(a) : a)));
        })
      );
    },
    []
  );

  const applicaEsitoChiacchieraAbitanti = useCallback((idA: number, idB: number) => {
    setAbitanti((prev) => applicaEsitoChiacchieraSuLista(prev, idA, idB));
  }, []);

  /** Il Re (o altro) adotta un abitante senza genitori vivi. */
  const adottaFiglio = useCallback((genitoreId: number, figlioId: number): boolean => {
    const prev = abitantiRef.current;
    const genitore = prev.find((a) => a.id === genitoreId);
    const figlio = prev.find((a) => a.id === figlioId);
    if (!genitore || !figlio) return false;
    if (haGenitoriVivi(figlio, prev)) return false;
    if ((genitore.figliIds ?? []).includes(figlioId)) return false;
    const next = applicaAdozione(genitore, figlio);
    setAbitanti(
      prev.map((a) =>
        a.id === genitoreId ? next.adottante : a.id === figlioId ? next.figlio : a
      )
    );
    return true;
  }, []);

  /** Accredita monete al tesoro (sink bar/negozio → stipendi). */
  const accreditaMoneteGiocatore = useCallback((quantità: number) => {
    const q = Math.floor(quantità);
    if (q <= 0) return;
    setMoneteGiocatore((prev) => prev + q);
  }, []);

  /** Addebita monete dal tesoro. `false` se saldo insufficiente. */
  const addebitaMoneteGiocatore = useCallback((quantità: number): boolean => {
    const q = Math.floor(quantità);
    if (q <= 0) return true;
    if (moneteGiocatoreRef.current < q) return false;
    moneteGiocatoreRef.current = Math.max(0, moneteGiocatoreRef.current - q);
    setMoneteGiocatore(moneteGiocatoreRef.current);
    return true;
  }, []);

  /** Appende una riga al diario di gioco (avvisi soft, es. furto scoperto). */
  const appendDiarioRiga = useCallback((riga: string) => {
    const t = (riga ?? "").trim();
    if (!t) return;
    setDiarioRighe((prev) => [...prev, t]);
  }, []);

  /**
   * Prelievo forzoso immediato: fino a `importo` monete da ogni suddito con inventario → Tesoro.
   * Esclude Re, Golem e casti senza inventario. Applica malus soddisfazione.
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

  // Tribunale: condanna a morte → rimuove l'abitante da regno e edifici (logica pura in src/game/tribunale).
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

  /** Disoccupato che raggiunge l’Emporio sulla mappa → Mercante (max 4). */
  const assumiDisoccupatoInEmporioDaMappa = useCallback(
    (abitanteId: number): boolean => {
      const r = assumiDisoccupatoInEmporio(abitanti, edifici, abitanteId);
      if (!r.ok) return false;
      setAbitanti(r.abitanti);
      setEdifici(r.edifici);
      return true;
    },
    [abitanti, edifici]
  );

  /** Disoccupato che raggiunge il Bosco sulla mappa → Raccoglitore. */
  const assumiDisoccupatoNelBoscoDaMappa = useCallback(
    (abitanteId: number): boolean => {
      const r = assumiDisoccupatoNelBosco(abitanti, edifici, abitanteId);
      if (!r.ok) return false;
      setAbitanti(r.abitanti);
      setEdifici(r.edifici);
      if (r.bottino) {
        for (const v of r.bottino.voci) {
          registraScambioCommerciale(
            voceRegistrazioneRaccoltaBosco({
              abitanteId: r.bottino.abitanteId,
              abitanteNome: r.bottino.abitanteNome,
              boscoId: r.bottino.boscoId,
              itemId: v.itemId,
              itemNome: v.nome,
              itemEmoji: v.emoji,
              quantità: v.quantità
            })
          );
        }
      }
      return true;
    },
    [abitanti, edifici, registraScambioCommerciale]
  );

  /** Disoccupato che raggiunge la Miniera sulla mappa → Minatore. */
  const assumiDisoccupatoNellaMinieraDaMappa = useCallback(
    (abitanteId: number): boolean => {
      const r = assumiDisoccupatoNellaMiniera(abitanti, edifici, abitanteId);
      if (!r.ok) return false;
      setAbitanti(r.abitanti);
      setEdifici(r.edifici);
      if (r.bottino) {
        for (const v of r.bottino.voci) {
          registraScambioCommerciale(
            voceRegistrazioneRaccoltaMiniera({
              abitanteId: r.bottino.abitanteId,
              abitanteNome: r.bottino.abitanteNome,
              minieraId: r.bottino.minieraId,
              itemId: v.itemId,
              itemNome: v.nome,
              itemEmoji: v.emoji,
              quantità: v.quantità
            })
          );
        }
      }
      return true;
    },
    [abitanti, edifici, registraScambioCommerciale]
  );

  /** Disoccupato che raggiunge il Castello sulla mappa → Guardia (max 4). */
  const assumiDisoccupatoComeGuardiaDaMappa = useCallback(
    (abitanteId: number): boolean => {
      const r = assumiDisoccupatoComeGuardia(abitanti, edifici, abitanteId);
      if (!r.ok) return false;
      setAbitanti(r.abitanti);
      setEdifici(r.edifici);
      return true;
    },
    [abitanti, edifici]
  );

  /**
   * Lavoro irraggiungibile: cerca altro edificio raggiungibile, altrimenti Bosco/Raccoglitore.
   * Elabora in batch sullo stesso snapshot per evitare race tra più abitanti nello stesso tick.
   */
  const ricollocaLavoroIrraggiungibileDaMappa = useCallback(
    (
      richieste: { abitanteId: number; fromCell: number }[],
      edificiInMappa: Record<number, EdificioInCellaLike>,
      cols: number,
      rows: number,
      isWalkable: (i: number) => boolean
    ): Record<number, { path: number[] | null; nuovoEdificioId?: number }> => {
      if (richieste.length === 0) return {};
      let abitantiCur = abitanti;
      let edificiCur = edifici;
      const out: Record<number, { path: number[] | null; nuovoEdificioId?: number }> = {};
      const bottini: NonNullable<RisultatoRicollocaLavoro["bottino"]>[] = [];
      for (const req of richieste) {
        const r = ricollocaSeLavoroIrraggiungibile(
          req.abitanteId,
          abitantiCur,
          edificiCur,
          req.fromCell,
          edificiInMappa,
          cols,
          rows,
          isWalkable
        );
        if (!r.ricollocato) continue;
        abitantiCur = r.abitanti;
        edificiCur = r.edifici;
        if (r.bottino) bottini.push(r.bottino);
        out[req.abitanteId] = {
          path: r.pathVersoNuovo ?? null,
          nuovoEdificioId: r.nuovoEdificioId
        };
      }
      if (Object.keys(out).length === 0) return {};
      setAbitanti(abitantiCur);
      setEdifici(edificiCur);
      for (const b of bottini) {
        for (const v of b.voci) {
          registraScambioCommerciale(
            voceRegistrazioneRaccoltaBosco({
              abitanteId: b.abitanteId,
              abitanteNome: b.abitanteNome,
              boscoId: b.boscoId,
              itemId: v.itemId,
              itemNome: v.nome,
              itemEmoji: v.emoji,
              quantità: v.quantità
            })
          );
        }
      }
      return out;
    },
    [abitanti, edifici, registraScambioCommerciale]
  );

  /** Raccoglitore vende 1 alimento all’Emporio (Mercante paga 1 moneta). */
  const vendeAlimentoAllEmporioDaMappa = useCallback(
    (abitanteId: number): boolean => {
      const emporioId =
        edifici.find((e) => e.nome === "Emporio" && e.stato === "Operativo")?.id ?? null;
      const invAttuale =
        emporioId != null ? inventarioEmporioRef.current[emporioId] : undefined;
      const r = eseguiVenditaAlimentoAllEmporio(abitanti, edifici, abitanteId, invAttuale);
      if (!r.ok || r.emporioId == null || !r.itemId || r.mercanteId == null) return false;
      const venditore = r.abitanti.find((a) => a.id === abitanteId);
      const mercante = r.abitanti.find((a) => a.id === r.mercanteId);
      const def = getOggettoInventario(r.itemId);
      setAbitanti(r.abitanti);
      setInventarioEmporioByEdificioId((prev) => ({
        ...prev,
        [r.emporioId!]: normalizzaInventarioEmporio(r.inventarioEmporio)
      }));
      registraScambioCommerciale({
        luogoEdificioId: r.emporioId!,
        luogoNome: "Emporio",
        daId: r.mercanteId!,
        daNome: mercante?.nome ?? `Mercante #${r.mercanteId}`,
        aId: abitanteId,
        aNome: venditore?.nome ?? `Abitante #${abitanteId}`,
        itemId: r.itemId!,
        itemNome: def?.nome ?? r.itemId!,
        itemEmoji: def?.emoji ?? "📦",
        prezzoMonete: PREZZO_VENDITA_ALIMENTO_EMPORIO
      });
      return true;
    },
    [abitanti, edifici, registraScambioCommerciale]
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

  // Mercato: ordini di acquisto/vendita; si eseguono solo al cambio mese (fine mese)
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
    gamePhase,
    simulationEnabled,
    startNewGame,
    restorePersistableState,
    createPersistableState,
    abitanti,
    inventarioGiocatore,
    moneteGiocatore,
    inventarioMensaByEdificioId,
    inventarioEmporioByEdificioId,
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
    nudismoAttivo,
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
    setNudismoAttivo,
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
    avanzaMese,
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
    assumiDisoccupatoInEmporioDaMappa,
    assumiDisoccupatoNelBoscoDaMappa,
    assumiDisoccupatoNellaMinieraDaMappa,
    assumiDisoccupatoComeGuardiaDaMappa,
    ricollocaLavoroIrraggiungibileDaMappa,
    vendeAlimentoAllEmporioDaMappa,
    trasferisciProprietaSchiavo,
    uccidiSchiavo,
    nominaMinistro,
    rimuoviMinistro,
    setNomeAbitante,
    aggiornaAbitanteById,
    aggiornaEdificioById,
    provaAssumiBaristaBarVuotoDaMappa,
    incassaImpresa,
    applicaPagaETipBarFineTurno,
    applicaEsitoChiacchieraAbitanti,
    adottaFiglio,
    accreditaMoneteGiocatore,
    addebitaMoneteGiocatore,
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
    modalitaRe,
    edificioVisitaReId,
    popolaritaRe,
    faseDisordine,
    mesiConsecutiviNelCastello,
    setModalitaRe,
    nativiNonIntegrati,
    pendingAssimilazione,
    accettaAssimilazione,
    rifiutaAssimilazione,
    pendingMatrimonio,
    confermaMatrimonio,
    rifiutaMatrimonio,
    setCastaAbitante,
    eventiInCorso,
    eventiCatalogo: EVENTI_CATALOGO,
    creazioneGiocatoreAperta,
    configuraGiocatore,
    introConsigliereAperta,
    chiudiIntroConsigliere,
    suggerimentoPonteAperto,
    chiudiSuggerimentoPonte,
    dialogPiazzaPonteAperto,
    apriDialogPiazzaPonte,
    chiudiDialogPiazzaPonte,
    introConsigliereVisto,
    diarioInizioVisto,
    nominaConsigliere,
    completaObiettivo,
    messaggioEmigrazione,
    chiudiMessaggioEmigrazione,
    diarioRighe,
    registrazioniScambi,
    /** Alias legacy: evita ReferenceError se il bundle HMR cita ancora registrazioniEmporio. */
    registrazioniEmporio: registrazioniScambi,
    registraScambioCommerciale,
    pendingRichiestaLuogoCulto,
    accettaRichiestaLuogoCulto,
    rifiutaRichiestaLuogoCulto,
    rimandaRichiestaLuogoCulto,
    richiesteInAttesa,
    accettaRichiestaInAttesa,
    rifiutaRichiestaInAttesa,
    luoghiCultoRifiutati,
    luoghiCultoPendentiMappa,
    setLuoghiCultoPendentiMappa,
    obiettiviCompletati,
    coltureSerraSbloccate,
    modalitaGioco,
    setModalitaGioco
  };
}
