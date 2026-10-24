/**
 * Catalogo obiettivi: albero a livelli.
 *
 * Ogni ObiettivoNodo ha:
 *  - tipo: Scoperta | Costruzione | Evento | Sociale
 *  - livello: 1–5 (usato per disporre verticalmente i nodi nell'albero)
 *  - requisitiId: nodi padre già completati richiesti
 *  - condizione: funzione pura che valuta lo stato di gioco
 *
 * Il motore valuta tutte le condizioni ogni fine mese e aggiorna
 * `obiettiviCompletati` nel salvataggio.
 */

import type { Abitante, Edificio, Risorsa } from "../types";
import type { ReligioneCustom } from "../game/fedeleCulto";
import { pretendeSovranoDivino } from "../game/dogmiReligiosi";
import { ID_GIOCATORE } from "../game/schiavituCommercio";

export type TipoObiettivo = "Scoperta" | "Costruzione" | "Evento" | "Sociale";

export type SbloccoObiettivo =
  | {
      tipo: "tassa";
      id: "patrimonio" | "reddito" | "iva";
    }
  | {
      tipo: "colture_serra";
    }
  | {
      /** Sblocca voci nel menu Costruisci (Avventura). Usa «Strada» / «Ambiente» per le opzioni speciali. */
      tipo: "edificio";
      nomi: string[];
    };

export type StatoValutazioneObiettivi = {
  abitanti: Abitante[];
  edifici: Edificio[];
  risorse: Risorsa[];
  mese: number;
  anno: number;
  moneteGiocatore: number;
  /** Id obiettivi già completati. */
  completati: ReadonlySet<string>;
  /** True se sulla mappa esiste almeno un Ponte operativo (attraversabile). */
  haPonteSulFiume?: boolean;
  religioniCustom?: readonly ReligioneCustom[];
  religioneDiStato?: string | null;
  politicaReligiosa?: "ateismo-stato" | "religione-stato" | "liberta-culto";
};

export type ObiettivoNodo = {
  id: string;
  titolo: string;
  descrizione: string;
  emoji: string;
  tipo: TipoObiettivo;
  /** Livello nell'albero (1 = radice, 5 = avanzato). */
  livello: number;
  /** Id degli obiettivi padre già completati richiesti. Vuoto = sempre visibile. */
  requisitiId: string[];
  /** Ricompensa visibile al giocatore. */
  ricompensa?: string;
  /** Sblocco gameplay concreto (es. tassa). */
  sblocca?: SbloccoObiettivo;
  /** Condizione: true = obiettivo completato. */
  condizione: (stato: StatoValutazioneObiettivi) => boolean;
};

function haEdificio(edifici: Edificio[], nome: string): boolean {
  return edifici.some((e) => e.nome === nome && e.stato === "Operativo");
}

function numAbitanti(abitanti: Abitante[]): number {
  return abitanti.filter((a) => a.razza !== "Golem").length;
}

function haLavoratore(abitanti: Abitante[], lavoro: string): boolean {
  return abitanti.some((a) => a.lavoro === lavoro);
}

export const OBIETTIVI_CATALOGO: ObiettivoNodo[] = [
  // ── Livello 1: Fondamenta ──────────────────────────────────────────────────
  {
    id: "primo_ponte",
    titolo: "Primo Ponte",
    descrizione:
      "Completa la costruzione di un Ponte sul fiume (il cantiere non basta: servono gli edili).",
    emoji: "🌉",
    tipo: "Costruzione",
    livello: 1,
    requisitiId: [],
    ricompensa: "Il regno impara a superare i corsi d'acqua.",
    condizione: (s) => s.haPonteSulFiume === true
  },
  {
    id: "primi_abitanti",
    titolo: "Le prime famiglie",
    descrizione: "Il tuo regno accoglie i primi 5 abitanti.",
    emoji: "👥",
    tipo: "Sociale",
    livello: 1,
    requisitiId: [],
    ricompensa: "Visibilità base: nome e lavoro degli abitanti.",
    condizione: (s) => numAbitanti(s.abitanti) >= 5
  },
  {
    id: "primo_edificio",
    titolo: "Mani che costruiscono",
    descrizione: "Costruisci il tuo primo edificio oltre al Castello.",
    emoji: "🏗️",
    tipo: "Costruzione",
    livello: 1,
    requisitiId: [],
    ricompensa: "Sblocco colonna Edifici nella scheda abitanti.",
    condizione: (s) =>
      s.edifici.filter((e) => e.nome !== "Castello" && e.stato === "Operativo").length >= 1
  },
  {
    id: "primo_mese",
    titolo: "Il primo mese",
    descrizione: "Sopravvivi al tuo primo mese di regno.",
    emoji: "📅",
    tipo: "Evento",
    livello: 1,
    requisitiId: [],
    condizione: (s) => s.anno > 0 || s.mese > 1
  },
  {
    id: "raccolto_serra",
    titolo: "Raccolto abbondante",
    descrizione: "Avere almeno 2 Agricoltori al lavoro nella Serra.",
    emoji: "🌱",
    tipo: "Costruzione",
    livello: 2,
    requisitiId: ["primo_mese"],
    ricompensa: "Sblocchi tutte le colture della Serra.",
    sblocca: { tipo: "colture_serra" },
    condizione: (s) =>
      s.edifici.some(
        (e) =>
          e.nome === "Serra" &&
          e.stato === "Operativo" &&
          (e.abitantiAssegnati?.length ?? 0) >= 2
      )
  },

  // ── Livello 2: Crescita ────────────────────────────────────────────────────
  {
    id: "dieci_abitanti",
    titolo: "Una comunità",
    descrizione: "Raggiungi 10 abitanti.",
    emoji: "🏘️",
    tipo: "Sociale",
    livello: 2,
    requisitiId: ["primi_abitanti"],
    ricompensa: "Sblocca scheda Famiglie (relazioni, matrimoni).",
    condizione: (s) => numAbitanti(s.abitanti) >= 10
  },
  {
    id: "prima_residenza",
    titolo: "Un tetto per tutti",
    descrizione: "Costruisci almeno una residenza oltre alle Capanne.",
    emoji: "🏠",
    tipo: "Costruzione",
    livello: 2,
    requisitiId: ["primo_edificio"],
    ricompensa: "Visibilità soddisfazione abitativa.",
    condizione: (s) =>
      s.edifici.some(
        (e) =>
          e.tipo === "Residenza" &&
          e.nome !== "Capanna" &&
          e.nome !== "Baracca" &&
          e.stato === "Operativo"
      )
  },
  {
    id: "primo_lavoro",
    titolo: "Chi lavora mangia",
    descrizione: "Almeno 3 abitanti hanno un lavoro assegnato (non Disoccupato).",
    emoji: "⚒️",
    tipo: "Sociale",
    livello: 2,
    requisitiId: ["primi_abitanti"],
    condizione: (s) =>
      s.abitanti.filter(
        (a) => a.lavoro !== "Disoccupato" && a.lavoro !== "Pensionato" && a.razza !== "Golem"
      ).length >= 3
  },
  {
    id: "primo_tesoro",
    titolo: "Le prime monete",
    descrizione: "Accumula 100 monete nel tesoro.",
    emoji: "💰",
    tipo: "Evento",
    livello: 2,
    requisitiId: ["primo_mese"],
    ricompensa: "Sblocca il Mercato per ordini di compravendita.",
    condizione: (s) => s.moneteGiocatore >= 100
  },

  // ── Livello 3: Specializzazione ───────────────────────────────────────────
  {
    id: "venti_abitanti",
    titolo: "Il regno cresce",
    descrizione: "Raggiungi 20 abitanti.",
    emoji: "👨‍👩‍👧‍👦",
    tipo: "Sociale",
    livello: 3,
    requisitiId: ["dieci_abitanti"],
    condizione: (s) => numAbitanti(s.abitanti) >= 20
  },
  {
    id: "medico_presente",
    titolo: "La conoscenza cura",
    descrizione: "Assegna un Medico o costruisci un Lazzaretto/Ospedale.",
    emoji: "🏥",
    tipo: "Scoperta",
    livello: 3,
    requisitiId: ["primo_lavoro"],
    ricompensa: "Visibilità stato di salute: Sano / Malato al posto di simboli vaghi.",
    condizione: (s) =>
      haLavoratore(s.abitanti, "Medico") ||
      haLavoratore(s.abitanti, "Medico della Peste") ||
      haEdificio(s.edifici, "Ospedale") ||
      haEdificio(s.edifici, "Lazzaretto")
  },
  {
    id: "giudice_presente",
    titolo: "La legge ha voce",
    descrizione: "Assegna un Giudice al Tribunale.",
    emoji: "⚖️",
    tipo: "Scoperta",
    livello: 3,
    requisitiId: ["primo_lavoro"],
    ricompensa: "Visibilità: accuse, prove e colpevolezza degli abitanti.",
    condizione: (s) => haLavoratore(s.abitanti, "Giudice") && haEdificio(s.edifici, "Tribunale")
  },
  {
    id: "prima_impresa",
    titolo: "L'economia privata",
    descrizione: "Costruisci un'impresa (Bar, Emporio o Fucina).",
    emoji: "🏭",
    tipo: "Costruzione",
    livello: 3,
    requisitiId: ["primo_tesoro", "primo_edificio"],
    ricompensa: "Sblocca la scheda Impresa con produzione e clienti.",
    condizione: (s) =>
      haEdificio(s.edifici, "Bar") ||
      haEdificio(s.edifici, "Emporio") ||
      haEdificio(s.edifici, "Fucina")
  },
  {
    id: "cancelleria_fiscale",
    titolo: "La cancelleria fiscale",
    descrizione: "Accumula 250 monete nel tesoro: il regno istituisce il registro patrimoniale.",
    emoji: "📜",
    tipo: "Evento",
    livello: 3,
    requisitiId: ["primo_tesoro"],
    ricompensa: "Sblocca la Tassa sul Patrimonio.",
    sblocca: { tipo: "tassa", id: "patrimonio" },
    condizione: (s) => s.moneteGiocatore >= 250
  },
  {
    id: "sacerdote_presente",
    titolo: "La fede si rivela",
    descrizione: "Costruisci un Luogo di Culto e assegna un Sacerdote.",
    emoji: "⛪",
    tipo: "Scoperta",
    livello: 3,
    requisitiId: ["dieci_abitanti"],
    ricompensa: "Visibilità: religione e fazione di ogni abitante.",
    condizione: (s) =>
      haLavoratore(s.abitanti, "Sacerdote") &&
      s.edifici.some((e) => e.tipo === "Luogo di Culto" && e.stato === "Operativo")
  },

  // ── Livello 4: Conoscenza avanzata ────────────────────────────────────────
  {
    id: "cinquanta_abitanti",
    titolo: "Una città",
    descrizione: "Raggiungi 50 abitanti.",
    emoji: "🏙️",
    tipo: "Sociale",
    livello: 4,
    requisitiId: ["venti_abitanti"],
    condizione: (s) => numAbitanti(s.abitanti) >= 50
  },
  {
    id: "riforma_reddito",
    titolo: "La riforma del reddito",
    descrizione: "Con 500 monete in tesoro e un Giudice al Tribunale, il regno tassifica i redditi.",
    emoji: "💰",
    tipo: "Evento",
    livello: 4,
    requisitiId: ["cancelleria_fiscale", "giudice_presente"],
    ricompensa: "Sblocca la Tassa sul Reddito.",
    sblocca: { tipo: "tassa", id: "reddito" },
    condizione: (s) =>
      s.moneteGiocatore >= 500 &&
      haLavoratore(s.abitanti, "Giudice") &&
      haEdificio(s.edifici, "Tribunale")
  },
  {
    id: "speziale_presente",
    titolo: "I rimedi del saggio",
    descrizione: "Costruisci una Spezieria e assegna uno Speziale.",
    emoji: "⚗️",
    tipo: "Scoperta",
    livello: 4,
    requisitiId: ["medico_presente"],
    ricompensa: "Visibilità: nome delle malattie comuni e preparazione rimedi.",
    condizione: (s) => haLavoratore(s.abitanti, "Speziale") && haEdificio(s.edifici, "Spezieria")
  },
  {
    id: "maestro_presente",
    titolo: "L'istruzione illumina",
    descrizione: "Costruisci una Scuola e assegna un Maestro.",
    emoji: "📚",
    tipo: "Scoperta",
    livello: 4,
    requisitiId: ["primo_lavoro"],
    ricompensa: "Visibilità: talento, potenziale e istruzione degli abitanti.",
    condizione: (s) =>
      (haLavoratore(s.abitanti, "Maestro") || haLavoratore(s.abitanti, "Insegnante")) &&
      (haEdificio(s.edifici, "Scuola") ||
        haEdificio(s.edifici, "Scuola Elementare") ||
        haEdificio(s.edifici, "Università"))
  },
  {
    id: "mago_presente",
    titolo: "L'occhio arcano",
    descrizione: "Costruisci un Laboratorio Magico e assegna un Alchimista.",
    emoji: "🧙",
    tipo: "Scoperta",
    livello: 4,
    requisitiId: ["prima_impresa"],
    ricompensa: "Visibilità: maledizioni, fenomeni soprannaturali e magia latente.",
    condizione: (s) =>
      haLavoratore(s.abitanti, "Alchimista") &&
      haEdificio(s.edifici, "Laboratorio Magico")
  },
  {
    id: "grande_tesoro",
    titolo: "Le casse del regno",
    descrizione: "Accumula 1 000 monete nel tesoro.",
    emoji: "🏦",
    tipo: "Evento",
    livello: 4,
    requisitiId: ["primo_tesoro", "prima_impresa"],
    condizione: (s) => s.moneteGiocatore >= 1000
  },

  // ── Livello 5: Eccellenza ──────────────────────────────────────────────────
  {
    id: "cento_abitanti",
    titolo: "Il popolo di un re",
    descrizione: "Raggiungi 100 abitanti.",
    emoji: "👑",
    tipo: "Sociale",
    livello: 5,
    requisitiId: ["cinquanta_abitanti"],
    condizione: (s) => numAbitanti(s.abitanti) >= 100
  },
  {
    id: "riforma_iva",
    titolo: "L'imposta sul valore",
    descrizione:
      "Con 1 000 monete in tesoro, un'impresa attiva e almeno 50 abitanti, il regno introduce l'IVA.",
    emoji: "📊",
    tipo: "Evento",
    livello: 5,
    requisitiId: ["riforma_reddito", "grande_tesoro", "cinquanta_abitanti"],
    ricompensa: "Sblocca l'Imposta sul Valore Aggiunto.",
    sblocca: { tipo: "tassa", id: "iva" },
    condizione: (s) =>
      s.moneteGiocatore >= 1000 &&
      numAbitanti(s.abitanti) >= 50 &&
      (haEdificio(s.edifici, "Bar") ||
        haEdificio(s.edifici, "Emporio") ||
        haEdificio(s.edifici, "Fucina"))
  },
  {
    id: "ospedale_pieno",
    titolo: "La medicina avanzata",
    descrizione: "Costruisci un Ospedale con almeno 3 lavoratori assegnati.",
    emoji: "🏥",
    tipo: "Scoperta",
    livello: 5,
    requisitiId: ["speziale_presente"],
    ricompensa: "Visibilità completa: malattia precisa, contagiosità, probabilità di guarigione.",
    condizione: (s) => {
      const osp = s.edifici.find((e) => e.nome === "Ospedale" && e.stato === "Operativo");
      return osp != null && (osp.abitantiAssegnati?.length ?? 0) >= 3;
    }
  },
  {
    id: "teocrazia",
    titolo: "Teocrazia",
    descrizione: "Fonda una religione che proclama il Re rappresentante divino sulla Terra e rendila religione di Stato.",
    emoji: "👑",
    tipo: "Sociale",
    livello: 4,
    requisitiId: [],
    ricompensa: "Obiettivo raggiunto: il potere regio si fonda anche su una dottrina religiosa.",
    condizione: (s) => {
      const regnante = s.abitanti.some(a => a.id === ID_GIOCATORE && a.salute > 0);
      if (!regnante || !s.religioneDiStato || s.politicaReligiosa !== "religione-stato") return false;
      return (s.religioniCustom ?? []).some(r =>
        r.nome === s.religioneDiStato &&
        r.fondatoreReId === ID_GIOCATORE &&
        pretendeSovranoDivino(r.dogmi ?? [])
      );
    }
  },
  {
    id: "universita_attiva",
    titolo: "La repubblica dei saperi",
    descrizione: "Costruisci un'Università con almeno 2 Professori.",
    emoji: "🎓",
    tipo: "Scoperta",
    livello: 5,
    requisitiId: ["maestro_presente"],
    ricompensa: "Visibilità: specializzazioni, percorsi di carriera e mobilità sociale.",
    condizione: (s) => {
      const uni = s.edifici.find((e) => e.nome === "Università" && e.stato === "Operativo");
      if (!uni) return false;
      const prof = s.abitanti.filter(
        (a) => a.lavoro === "Professore" && uni.abitantiAssegnati?.includes(a.id)
      ).length;
      return prof >= 2;
    }
  }
];

/** Mappa id → definizione per lookup rapido. */
export const OBIETTIVI_BY_ID: ReadonlyMap<string, ObiettivoNodo> = new Map(
  OBIETTIVI_CATALOGO.map((o) => [o.id, o])
);

/** Tutti gli id degli obiettivi che sono sbloccati (requisiti soddisfatti) dato un set di completati. */
export function obiettiviSbloccati(completati: ReadonlySet<string>): Set<string> {
  return new Set(
    OBIETTIVI_CATALOGO
      .filter((o) => o.requisitiId.every((req) => completati.has(req)))
      .map((o) => o.id)
  );
}
