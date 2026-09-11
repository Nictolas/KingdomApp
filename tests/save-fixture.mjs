import { SAVE_FORMAT, SAVE_SCHEMA_VERSION } from "../src/persistence/saveTypes.ts";

export function createSaveEnvelope() {
  const abitante = {
    id: 1,
    nome: "Ada Nova",
    emoji: "👑",
    eta: 30,
    lavoro: "Re",
    competenza: 80,
    produttività: 75,
    stanchezza: 10,
    personalità: "Empatico",
    amici: [],
    rivali: [],
    fazioni: ["Amministrazione"],
    peso: 55,
    salute: 90,
    reddito: 30,
    spese: 0,
    paura: 0,
    felicità: 80,
    religione: "Ateo",
    razza: "Umano",
    aspetto: {
      coloreCapelli: "#6b3f24",
      stileCapelli: "spettinati",
      stileOcchi: "tondi",
      colorePelle: "#e9b38f",
      vestiti: "viandante",
      cappello: "nessuno"
    },
    inventario: [{ itemId: "monete", quantità: 25 }]
  };
  const edificio = {
    id: 1,
    nome: "Castello",
    emoji: "🏛️",
    tipo: "Amministrazione",
    descrizione: "Centro",
    capacità: 10,
    occupazione: 1,
    abitantiAssegnati: [1],
    efficienza: 90,
    manutenzione: 0,
    stato: "Operativo",
    livello: 1
  };
  return {
    format: SAVE_FORMAT,
    schemaVersion: SAVE_SCHEMA_VERSION,
    metadata: {
      saveId: "save-test-1",
      gameVersion: "0.1.0",
      createdAt: "2026-08-28T10:00:00.000Z",
      updatedAt: "2026-08-28T11:00:00.000Z"
    },
    payload: {
      gamePhase: "running",
      introductionCompleted: true,
      diarioInizioVisto: true,
      population: {
        abitanti: [abitante],
        abitantiProposti: [],
        nextId: 2,
        razzaNativi: "Elfo",
        nativiNonIntegrati: 120
      },
      colony: {
        edifici: [edificio],
        risorse: [{ id: 2, nome: "Cibo", quantità: 100, unità: "razioni" }],
        inventarioGiocatore: [{ itemId: "mela", quantità: 10 }],
        inventarioMensaByEdificioId: { 1: [{ itemId: "mela", quantità: 3 }] },
        moneteGiocatore: 500,
        prezzoResidenze: { Dormitorio: 10 }
      },
      calendar: { mese: 4, anno: 2, giorno: 35, minutiDaMezzanotte: 720, pausaManuale: false },
      simulationCursors: {
        ultimoGiornoPasti: 34,
        ultimoGiornoProduzioneSerra: 35,
        ultimoGiornoEconomiaPubblica: 35
      },
      policies: {
        tipoTassaReddito: "scaglioni",
        flatTaxPercentuale: 15,
        scaglioniConfig: [
          { min: 0, max: 300, percentuale: 0 },
          { min: 301, max: Infinity, percentuale: 30 }
        ],
        politicaNascite: "nessuna",
        punteggioSanzioni: 1,
        penaDiMorteAttiva: false,
        penaReati: { Omicidio: 20, Stupro: 15, Furto: 2, Spaccio: 3, Evasione: 5, "Ex Governatore": 10 },
        politicaReligiosa: "liberta-culto",
        religioneDiStato: null,
        leggeRazzialeAttiva: false,
        razzaCampoLavoro: null,
        razzaCampoSterminio: null,
        etaMinimaLavoro: 18,
        etaPensionabile: 65,
        assegnoPensionati: 30,
        leggeDroghe: "vietate",
        divietoEspatrioAttivo: false,
        coprifuocoAttivo: false,
        coprifuocoInizioMinuti: 1320,
        coprifuocoFineMinuti: 360,
        iusPrimaeNoctisAttivo: false,
        tipologieFamigliaAccettate: {
          tradizionale: true,
          interrazziale: true,
          arcobaleno: true,
          monogenitoriale: true,
          matrimonioUmanoRobot: false,
          matrimonioIntercasta: false
        },
        redditoCittadinanza: 0,
        modalitaSanita: "privata"
      },
      events: {
        ordiniMercato: [{ id: 1, tipo: "compra", risorsaId: 2, quantità: 5, prezzoUnitario: 2 }],
        eventiInCorso: [{ id: "tempesta-solare", iniziatoMese: 4, iniziatoAnno: 2, durataMesi: 2 }],
        soddisfazioneFazioni: { Rivoluzionari: 80 },
        pendingAssimilazione: 4,
        pendingMatrimonio: null,
        messaggioEmigrazione: null,
        diarioRighe: ["La colonia è operativa."],
        capoReligiosoSole: null,
        capoReligiosoAlieni: null,
        pendingRichiestaLuogoCulto: null,
        richiesteInAttesa: [],
        luoghiCultoRifiutati: [],
        luoghiCultoPendentiMappa: []
      },
      map: {
        edificiInMappa: { 10: { id: 1, nome: "Castello", emoji: "🏰", edificioGlobaleId: 1 } },
        terrenoInMappa: { 11: "river" },
        decorazioniInMappa: { 12: "🌳" },
        residenzeMappa: { 10: [1] }
      }
    }
  };
}
