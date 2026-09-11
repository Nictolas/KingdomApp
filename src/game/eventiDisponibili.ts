import type { Abitante, Edificio, Risorsa, EventoInCorso } from "../types";
import type { EventoDef } from "./eventi/eventoTypes";
import { esisteCoppiaMatrimonioPossibile } from "./avanzaMese";
import { trovaCapoReligiosoSenzaLuogo } from "./luogoCulto";
import type { ReligioneConCulto } from "./luogoCulto";
import type { RichiestaInAttesa } from "./richieste";
import { eventoRichiestaLuogoCulto } from "./eventi/richiestaLuogoCulto";

export type StatoEventoUI = "in-corso" | "disponibile" | "in-attesa" | "rimandato" | "possibile";

export type EventoUICard = {
  id: string;
  nome: string;
  emoji: string;
  descrizione: string;
  stato: StatoEventoUI;
};

export type EventiUIInput = {
  abitanti: Abitante[];
  edifici: Edificio[];
  risorse: Risorsa[];
  eventiInCorso: EventoInCorso[];
  eventiCatalogo: EventoDef[];
  punteggioSanzioni: number;
  divietoEspatrioAttivo: boolean;
  calcolaFelicitàModificata: (a: Abitante) => number;
  soddisfazioneFazioni: Record<string, number>;
  politicaNascite: "figlio-unico" | "incentivi" | "nessuna";
  tipologieFamigliaAccettate?: {
    matrimonioUmanoRobot: boolean;
    matrimonioIntercasta?: boolean;
  };
  pendingAssimilazione: number | null;
  pendingRichiestaLuogoCulto: { id: number; nome: string; religione: string } | null;
  richiesteInAttesa: RichiestaInAttesa[];
  luoghiCultoRifiutati: ReligioneConCulto[];
  capoReligiosoSole: number | null;
  capoReligiosoAlieni: number | null;
};

function esisteCoppiaSposata(abitanti: Abitante[]): boolean {
  return abitanti.some((a) => a.coniugeId != null);
}

export function calcolaEventiUI(input: EventiUIInput): {
  inCorso: EventoUICard[];
  disponibili: EventoUICard[];
  possibili: EventoUICard[];
} {
  const {
    abitanti,
    edifici,
    risorse,
    eventiInCorso,
    eventiCatalogo,
    punteggioSanzioni,
    divietoEspatrioAttivo,
    calcolaFelicitàModificata,
    soddisfazioneFazioni,
    politicaNascite,
    tipologieFamigliaAccettate,
    pendingAssimilazione,
    pendingRichiestaLuogoCulto,
    richiesteInAttesa,
    luoghiCultoRifiutati,
    capoReligiosoSole,
    capoReligiosoAlieni
  } = input;

  const idsInCorso = new Set(eventiInCorso.map((e) => e.id));
  const inCorso: EventoUICard[] = [];
  const disponibili: EventoUICard[] = [];
  const possibili: EventoUICard[] = [];

  for (const ev of eventiCatalogo) {
    const condizioneOk = ev.condizione(
      abitanti,
      risorse,
      edifici,
      punteggioSanzioni,
      divietoEspatrioAttivo,
      calcolaFelicitàModificata,
      soddisfazioneFazioni
    );
    const card: EventoUICard = {
      id: ev.id,
      nome: ev.nome,
      emoji: ev.emoji,
      descrizione: ev.descrizione,
      stato: idsInCorso.has(ev.id) ? "in-corso" : condizioneOk ? "disponibile" : "possibile"
    };
    if (idsInCorso.has(ev.id)) inCorso.push(card);
    else if (condizioneOk) disponibili.push(card);
    else possibili.push(card);
  }

  // Assimilazione in attesa di risposta
  if (pendingAssimilazione != null && pendingAssimilazione > 0) {
    inCorso.push({
      id: "assimilazione-pending",
      nome: "Assimilazione",
      emoji: "🤝",
      descrizione: `${pendingAssimilazione} nativi vogliono unirsi al regno. Rispondi dalla pagina Eventi o attendi.`,
      stato: "in-attesa"
    });
  }

  // Richiesta Luogo di Culto (evento immediato, non mensile)
  const richiestaRimandata = richiesteInAttesa.find((r) => r.tipo === "luogo-culto");
  if (pendingRichiestaLuogoCulto) {
    inCorso.push({
      id: "richiesta-luogo-culto",
      nome: eventoRichiestaLuogoCulto.nome,
      emoji: eventoRichiestaLuogoCulto.emoji,
      descrizione: `${pendingRichiestaLuogoCulto.nome} attende la tua risposta (Accetta / Rifiuta / Devo pensarci).`,
      stato: "in-attesa"
    });
  } else if (richiestaRimandata) {
    inCorso.push({
      id: "richiesta-luogo-culto-rimandata",
      nome: eventoRichiestaLuogoCulto.nome,
      emoji: eventoRichiestaLuogoCulto.emoji,
      descrizione: `Richiesta rimandata da ${richiestaRimandata.nomeCapo}. Vedi «Richieste» sulla mappa.`,
      stato: "rimandato"
    });
  } else {
    const capo = trovaCapoReligiosoSenzaLuogo(abitanti, edifici, undefined, {
      sole: capoReligiosoSole,
      alieni: capoReligiosoAlieni
    });
    if (
      capo &&
      (capo.religione === "Culto del Sole" || capo.religione === "Culto delle Ombre") &&
      !luoghiCultoRifiutati.includes(capo.religione as ReligioneConCulto)
    ) {
      disponibili.push({
        id: "richiesta-luogo-culto",
        nome: eventoRichiestaLuogoCulto.nome,
        emoji: eventoRichiestaLuogoCulto.emoji,
        descrizione: eventoRichiestaLuogoCulto.descrizione,
        stato: "disponibile"
      });
    }
  }

  // Matrimonio
  const puòMatrimonio = esisteCoppiaMatrimonioPossibile(abitanti, tipologieFamigliaAccettate);
  const matrimonioCard: EventoUICard = {
    id: "matrimonio",
    nome: "Matrimonio",
    emoji: "💒",
    descrizione: puòMatrimonio
      ? "Una coppia compatibile con amicizia ≥90 può chiedere di sposarsi a fine mese."
      : "Serve una coppia con amicizia ≥90 e compatibile (orientamento/sesso).",
    stato: puòMatrimonio ? "disponibile" : "possibile"
  };
  if (puòMatrimonio) disponibili.push(matrimonioCard);
  else possibili.push(matrimonioCard);

  // Nascita
  const incinte = abitanti.filter((a) => a.incinta === true);
  if (incinte.length > 0) {
    inCorso.push({
      id: "nascita",
      nome: "Nascita",
      emoji: "👶",
      descrizione:
        incinte.length === 1
          ? `${incinte[0]!.nome} è incinta. Parto tra 9 mesi dall'inizio gravidanza.`
          : `${incinte.map((a) => a.nome).join(", ")} sono incinte.`,
      stato: "in-corso"
    });
  } else if (politicaNascite !== "nessuna" && esisteCoppiaSposata(abitanti)) {
    disponibili.push({
      id: "nascita",
      nome: "Nascita",
      emoji: "👶",
      descrizione: "Le coppie sposate possono concepire a fine mese (Legge sulle Nascite attiva).",
      stato: "disponibile"
    });
  } else {
    possibili.push({
      id: "nascita",
      nome: "Nascita",
      emoji: "👶",
      descrizione: "Attiva una politica sulle nascite e avere coppie sposate.",
      stato: "possibile"
    });
  }

  return { inCorso, disponibili, possibili };
}
