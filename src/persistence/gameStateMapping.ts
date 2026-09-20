import type { Abitante, Edificio, EventoInCorso, OrdineMercato, Razza, Risorsa } from "../types";
import type { MappaRuntimeState } from "../game/mappaTypes";
import type { PenaReatiConfig } from "../game/reati";
import type { ReligioneConCulto } from "../game/luogoCulto";
import type { RichiestaInAttesa } from "../game/richieste";
import type { VoceInventario } from "../game/inventario";
import { normalizeGameSave } from "./saveValidation.ts";
import type { GameSaveV1, SaveGamePhase, ScaglioneSalvato } from "./saveTypes.ts";
import type { GameMode } from "../game/gameMode";
import { TASSA_PATRIMONIO_PERCENTUALE_DEFAULT, IVA_PERCENTUALE_DEFAULT } from "../game/economiaPrezzi";
import type { RegistrazioneScambio } from "../game/registrazioniScambi";

/** Snapshot persistibile del runtime attuale, senza alcuno stato visuale. */
export type PersistableGameState = {
  gameMode: GameMode;
  gamePhase: SaveGamePhase;
  introductionCompleted: boolean;
  diarioInizioVisto: boolean;
  abitanti: Abitante[];
  abitantiProposti: Abitante[];
  nextId: number;
  razzaNativi: Razza;
  nativiNonIntegrati: number;
  edifici: Edificio[];
  risorse: Risorsa[];
  inventarioGiocatore: VoceInventario[];
  inventarioMensaByEdificioId: Record<number, VoceInventario[]>;
  inventarioEmporioByEdificioId: Record<number, VoceInventario[]>;
  moneteGiocatore: number;
  prezzoResidenze: Record<string, number>;
  mese: number;
  anno: number;
  giorno: number;
  minutiDaMezzanotte: number;
  pausaManuale: boolean;
  ultimoGiornoPasti: number;
  ultimoGiornoProduzioneSerra: number;
  ultimoGiornoEconomiaPubblica: number;
  tipoTassaReddito: "flat" | "scaglioni";
  flatTaxPercentuale: number;
  scaglioniConfig: ScaglioneSalvato[];
  tassaPatrimonioPercentuale: number;
  ivaPercentuale: number;
  politicaNascite: "figlio-unico" | "incentivi" | "nessuna";
  punteggioSanzioni: number;
  penaDiMorteAttiva: boolean;
  penaReati: PenaReatiConfig;
  politicaReligiosa: "ateismo-stato" | "religione-stato" | "liberta-culto";
  religioneDiStato: Abitante["religione"] | null;
  religioniCustom?: import("../game/fedeleCulto").ReligioneCustom[];
  leggeRazzialeAttiva: boolean;
  razzaCampoLavoro: Razza | null;
  razzaCampoSterminio: Razza | null;
  etaMinimaLavoro: number;
  etaPensionabile: number;
  assegnoPensionati: number;
  leggeDroghe: "vietate" | "legali" | "parziali";
  nudismoAttivo?: boolean;
  divietoEspatrioAttivo: boolean;
  coprifuocoAttivo: boolean;
  coprifuocoInizioMinuti: number;
  coprifuocoFineMinuti: number;
  iusPrimaeNoctisAttivo: boolean;
  tipologieFamigliaAccettate: GameSaveV1["policies"]["tipologieFamigliaAccettate"];
  redditoCittadinanza: number;
  modalitaSanita: "privata" | "pubblica";
  ordiniMercato: OrdineMercato[];
  eventiInCorso: EventoInCorso[];
  soddisfazioneFazioni: Record<string, number>;
  modalitaRe: "nel_castello" | "a_giro" | "in_visita";
  edificioVisitaReId: number | null;
  popolaritaRe: number;
  mesiConsecutiviNelCastello: number;
  faseDisordine: "nessuna" | "protesta" | "ribellione";
  avvisoReAssenteEmesso: boolean;
  pendingAssimilazione: number | null;
  pendingMatrimonio: GameSaveV1["events"]["pendingMatrimonio"];
  messaggioEmigrazione: string | null;
  diarioRighe: string[];
  registrazioniScambi: RegistrazioneScambio[];
  capoReligiosoSole: number | null;
  capoReligiosoAlieni: number | null;
  pendingRichiestaLuogoCulto: GameSaveV1["events"]["pendingRichiestaLuogoCulto"];
  richiesteInAttesa: RichiestaInAttesa[];
  luoghiCultoRifiutati: ReligioneConCulto[];
  luoghiCultoPendentiMappa: GameSaveV1["events"]["luoghiCultoPendentiMappa"];
  obiettiviCompletati: string[];
  coltureSerraSbloccate: string[];
  mappa: MappaRuntimeState;
};

export function gameStateToGameSaveV1(state: PersistableGameState): GameSaveV1 {
  return normalizeGameSave({
    gameMode: state.gameMode,
    gamePhase: state.gamePhase,
    introductionCompleted: state.introductionCompleted,
    diarioInizioVisto: state.diarioInizioVisto,
    population: {
      abitanti: state.abitanti,
      abitantiProposti: state.abitantiProposti,
      nextId: state.nextId,
      razzaNativi: state.razzaNativi,
      nativiNonIntegrati: state.nativiNonIntegrati
    },
    colony: {
      edifici: state.edifici,
      risorse: state.risorse,
      inventarioGiocatore: state.inventarioGiocatore,
      inventarioMensaByEdificioId: state.inventarioMensaByEdificioId,
      inventarioEmporioByEdificioId: state.inventarioEmporioByEdificioId,
      moneteGiocatore: state.moneteGiocatore,
      prezzoResidenze: state.prezzoResidenze
    },
    calendar: {
      mese: state.mese,
      anno: state.anno,
      giorno: state.giorno,
      minutiDaMezzanotte: state.minutiDaMezzanotte,
      pausaManuale: state.pausaManuale
    },
    simulationCursors: {
      ultimoGiornoPasti: state.ultimoGiornoPasti,
      ultimoGiornoProduzioneSerra: state.ultimoGiornoProduzioneSerra,
      ultimoGiornoEconomiaPubblica: state.ultimoGiornoEconomiaPubblica
    },
    policies: {
      tipoTassaReddito: state.tipoTassaReddito,
      flatTaxPercentuale: state.flatTaxPercentuale,
      scaglioniConfig: state.scaglioniConfig,
      tassaPatrimonioPercentuale: state.tassaPatrimonioPercentuale,
      ivaPercentuale: state.ivaPercentuale,
      politicaNascite: state.politicaNascite,
      punteggioSanzioni: state.punteggioSanzioni,
      penaDiMorteAttiva: state.penaDiMorteAttiva,
      penaReati: state.penaReati,
      politicaReligiosa: state.politicaReligiosa,
      religioneDiStato: state.religioneDiStato,
      ...(state.religioniCustom !== undefined
        ? { religioniCustom: state.religioniCustom }
        : {}),
      leggeRazzialeAttiva: state.leggeRazzialeAttiva,
      razzaCampoLavoro: state.razzaCampoLavoro,
      razzaCampoSterminio: state.razzaCampoSterminio,
      etaMinimaLavoro: state.etaMinimaLavoro,
      etaPensionabile: state.etaPensionabile,
      assegnoPensionati: state.assegnoPensionati,
      leggeDroghe: state.leggeDroghe,
      nudismoAttivo: state.nudismoAttivo,
      divietoEspatrioAttivo: state.divietoEspatrioAttivo,
      coprifuocoAttivo: state.coprifuocoAttivo,
      coprifuocoInizioMinuti: state.coprifuocoInizioMinuti,
      coprifuocoFineMinuti: state.coprifuocoFineMinuti,
      iusPrimaeNoctisAttivo: state.iusPrimaeNoctisAttivo,
      tipologieFamigliaAccettate: state.tipologieFamigliaAccettate,
      redditoCittadinanza: state.redditoCittadinanza,
      modalitaSanita: state.modalitaSanita
    },
    events: {
      ordiniMercato: state.ordiniMercato,
      eventiInCorso: state.eventiInCorso,
      soddisfazioneFazioni: state.soddisfazioneFazioni,
      modalitaRe: state.modalitaRe,
      edificioVisitaReId: state.edificioVisitaReId,
      popolaritaRe: state.popolaritaRe,
      mesiConsecutiviNelCastello: state.mesiConsecutiviNelCastello,
      faseDisordine: state.faseDisordine,
      avvisoReAssenteEmesso: state.avvisoReAssenteEmesso,
      pendingAssimilazione: state.pendingAssimilazione,
      pendingMatrimonio: state.pendingMatrimonio,
      messaggioEmigrazione: state.messaggioEmigrazione,
      diarioRighe: state.diarioRighe,
      registrazioniScambi: state.registrazioniScambi,
      capoReligiosoSole: state.capoReligiosoSole,
      capoReligiosoAlieni: state.capoReligiosoAlieni,
      pendingRichiestaLuogoCulto: state.pendingRichiestaLuogoCulto,
      richiesteInAttesa: state.richiesteInAttesa,
      luoghiCultoRifiutati: state.luoghiCultoRifiutati,
      luoghiCultoPendentiMappa: state.luoghiCultoPendentiMappa,
      obiettiviCompletati: state.obiettiviCompletati,
      coltureSerraSbloccate: state.coltureSerraSbloccate
    },
    map: state.mappa
  });
}

export function gameSaveV1ToGameState(save: GameSaveV1): PersistableGameState {
  const normalized = normalizeGameSave(save);
  return {
    gameMode: normalized.gameMode ?? "avventura",
    gamePhase: normalized.gamePhase,
    introductionCompleted: normalized.introductionCompleted,
    diarioInizioVisto: normalized.diarioInizioVisto,
    ...normalized.population,
    ...normalized.colony,
    inventarioEmporioByEdificioId: normalized.colony.inventarioEmporioByEdificioId ?? {},
    mese: normalized.calendar.mese,
    anno: normalized.calendar.anno,
    giorno: normalized.calendar.giorno,
    minutiDaMezzanotte: normalized.calendar.minutiDaMezzanotte,
    pausaManuale: normalized.calendar.pausaManuale,
    ...normalized.simulationCursors,
    ...normalized.policies,
    nudismoAttivo: normalized.policies.nudismoAttivo ?? false,
    tassaPatrimonioPercentuale:
      normalized.policies.tassaPatrimonioPercentuale ?? TASSA_PATRIMONIO_PERCENTUALE_DEFAULT,
    ivaPercentuale: normalized.policies.ivaPercentuale ?? IVA_PERCENTUALE_DEFAULT,
    ...normalized.events,
    registrazioniScambi: normalized.events.registrazioniScambi ?? [],
    modalitaRe: normalized.events.modalitaRe ?? "a_giro",
    edificioVisitaReId: normalized.events.edificioVisitaReId ?? null,
    popolaritaRe: normalized.events.popolaritaRe ?? 50,
    mesiConsecutiviNelCastello: normalized.events.mesiConsecutiviNelCastello ?? 0,
    faseDisordine: normalized.events.faseDisordine ?? "nessuna",
    avvisoReAssenteEmesso: normalized.events.avvisoReAssenteEmesso ?? false,
    obiettiviCompletati: normalized.events.obiettiviCompletati ?? [],
    coltureSerraSbloccate: normalized.events.coltureSerraSbloccate ?? [],
    mappa: normalized.map
  };
}
