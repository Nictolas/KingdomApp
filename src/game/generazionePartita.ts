import type { Abitante, Razza } from "../types";
import { abitanteConInventarioIniziale } from "./inventario";
import { inferTitoloStudioPerEta } from "./titoloStudio";
import { specializzazioneCasuale } from "./specializzazione";
import { pianetiData, getEmojiRazza } from "../kingdomData";
import { generaNomeAlieno } from "./nomiAlieni";
import { CONSIGLIERE_ETA_INIZIALE, creaAspettoConsigliereIniziale, generaAspettoCasuale } from "./personaggioAspetto";
import { COGNOMI_UMANI, NOMI_UMANI_CON_SESSO, scegliNomeCognomeUmano } from "./nomiUmani";
import { LAVORO_GIOCATORE, ETA_GIOCATORE_INIZIALE } from "./schiavituCommercio";
import { redditoMensileLavoroDefault, STIPENDIO_BASE_MONETE_MESE } from "./economiaPrezzi";
import { alimentazioneCasuale } from "./alimentazione";
import { aggiungiCuginoNobileConSchiaviAvventura } from "./cuginoNobileAvventura";
import { puoDiventareFedeleCulto } from "./fedeleCulto";

export type ModalitaGiocoGenerazione = "creativa" | "avventura";

/** Regole di generazione casuale del regno iniziale (per la pagina "Generazione Partita"). */
export const REGOLE_GENERAZIONE_PARTITA: { titolo: string; punti: string[] }[] = [
  {
    titolo: "Modalità",
    punti: [
      "Creativa: colonia ricca (20–28 abitanti) e molti edifici già presenti, inclusi Scuola e Lazzaretto.",
      "Avventura: pochi abitanti (6–8 + cugino Nobile con 2 Schiavi) e pochi edifici (Castello, Capanna, Serra, Porto, Bosco, Miniera ×3, Zecca, Emporio, Ufficio Edile, Chiesa)."
    ]
  },
  {
    titolo: "Numero abitanti",
    punti: [
      "Creativa: tra 20 e 28 abitanti (numero estratto a caso).",
      "Avventura: tra 6 e 8 abitanti di base (Re, Consigliere, Agricoltore, Edile, 2 Minatori, 1 Monetiere e eventuali altri), più 1 cugino Nobile del Re con 2 Schiavi privati."
    ]
  },
  {
    titolo: "Razza",
    punti: [
      "Il Re è sempre di razza umana.",
      "Per i test: oltre agli umani, per ogni razza attiva (Nano, Scheletro, Vampiro, Goblin, Orco, Lucertoloide) ci sono almeno 1 maschio e 1 femmina adulti.",
      "La razza dei Nativi (per l’evento Assimilazione) è scelta a caso tra le razze non umane.",
      "Ogni partita deve partire con 2-3 Nativi tra gli abitanti (razza = popolo nativo del territorio). Tutti gli abitanti non Senzatetto sono assegnati alle Capanne.",
      "Ogni partita deve partire con 1 Golem (senza sesso, orientamento «Bi»)."
    ]
  },
  {
    titolo: "Personalità",
    punti: [
      "Solo personalità del catalogo: Pollice Verde, Salutista, Empatico, Depresso, Carismatico, Psicopatico, Stakanovista, Tiepido, Omofobo, Razzista, Sessista.",
      "Distribuzione: circa 35% Tiepido, il resto distribuito in modo uniforme tra le altre."
    ]
  },
  {
    titolo: "Alimentazione",
    punti: ["Ogni abitante è Onnivoro, Vegetariano o Vegano."]
  },
  {
    titolo: "Religione",
    punti: [
      "Distribuzione uniforme tra: Ateo, Deista, Agnostico, Culto del Sole, Culto delle Ombre.",
      "Ateo e Deista non possono diventare Fedeli di un culto.",
      "A inizio partita c'è sempre un abitante con Occupazione «Capo Spirituale» (casta Clero) e Religione «Culto del Sole» (non Ateo né Deista)."
    ]
  },
  {
    titolo: "Fazioni e ruoli",
    punti: [
      "Ogni abitante ha sempre la fazione «Cittadini» più una di: Amministrazione, Lavoratori, Scienziati, Esploratori (scelta a caso).",
      "Almeno 4 abitanti sono «Schiavi»: hanno fazione Schiavi (e non Cittadini), ruoloSchiavitu «schiavo», monete/reddito/spese a 0.",
      "4 abitanti hanno la fazione «Lealisti», tra cui l'ex governatore (prigioniero in Tribunale).",
      "Il Re e 3 altri abitanti (escluso l'Ex Governatore) hanno la fazione «Rivoluzionari»: chi ha fatto la Rivoluzione.",
      "Ci sono alcuni Immigrati fin da inizio partita."
    ]
  },
  {
    titolo: "Casta",
    punti: [
      "Il Re ha casta «Nobile».",
      "Avventura: a inizio partita c’è 1 cugino Nobile del Re (ramo paterno) con 2 Schiavi privati.",
      "Gli abitanti con ruoloSchiavitu «schiavo» senza padrone hanno casta «Servo della gleba» (schiavi del regno).",
      "Il Clero (Sacerdote / Capo Spirituale) non consuma cibo né usa denaro.",
      "Tutti gli altri abitanti hanno casta «Cittadino».",
      "Chi sposa un Nobile diventa Nobile; i figli di almeno un genitore Nobile nascono Nobili.",
      "Il Re può cambiare la casta di qualsiasi abitante (scheda abitante).",
      "Alcuni immigrati (~12%) arrivano già Nobili."
    ]
  },
  {
    titolo: "Nome ed emoji",
    punti: [
      "Umani: nome e cognome da liste fisse (es. Marco Rossi, Anna Bianchi).",
      "Popoli fantasy: ogni razza usa nomi ed emoji coerenti con la propria cultura."
    ]
  },
  {
    titolo: "Statistiche (range)",
    punti: [
      "Età: 18–65 anni.",
      "Competenza: 30–95. Produttività: 40–95. Stanchezza: 0–60.",
      "Peso: 41–90. Salute: 40–90. Monete inventario: 20–40 (0 se schiavo). Reddito display ≈ stipendio mensile base; spese 0 (costi reali a parte).",
      "Paura: 0–40. Felicità: 40–90."
    ]
  },
  {
    titolo: "Lavoro",
    punti: [
      `Il primo abitante (id 1) è «${LAVORO_GIOCATORE}» con ${ETA_GIOCATORE_INIZIALE} anni e competenza alta.`,
      "Il 50% degli abitanti deve avere come Lavoro «Disoccupato»; il restante a caso tra: Ricercatore, Medico, Agricoltore, Taglialegna, Fabbro, Minatore, Esploratore, Sicurezza.",
      "A inizio partita c'è almeno 1 lavoratore assegnato alla Serra: un abitante con Lavoro «Agricoltore».",
      "Avventura: a inizio partita c'è almeno 1 Edile già assegnato e presente nell’Ufficio Edile.",
      "A inizio partita c'è almeno 1 abitante con Lavoro «Prigioniero»: è l'Ex Governatore (Razza Umano, reato «Ex Governatore»), assegnato al Campo di Lavoro; compare in Tribunale.",
      "A inizio partita c'è sempre 1 «Consigliere» (uomo umano, 60 anni, pelato, pelle Light, Basic Beard White) che vive nel Castello."
    ]
  },
  {
    titolo: "Residenza",
    punti: [
      "Il 50% degli abitanti ha Residenza in Baracca e il restante in Dormitorio."
    ]
  },
  {
    titolo: "Sesso e orientamento",
    punti: [
      "Ogni abitante ha Sesso M o F coerente al nome (es. Alessandro sempre M, Anna sempre F).",
      "I Golem hanno sempre orientamento «Bi» (bisessuali); è una regola fondamentale.",
      "Per i non-Golem a inizio partita: 1 con Orientamento «Omo», 2 con «Bi», il resto con «Etero»."
    ]
  },
  {
    titolo: "Relazioni",
    punti: [
      "Amici e rivali iniziali: vuoti (nessun legame predefinito)."
    ]
  }
];

const NUM_ABITANTI_MIN_CREATIVA = 20;
const NUM_ABITANTI_MAX_CREATIVA = 28;
const NUM_ABITANTI_MIN_AVVENTURA = 6;
const NUM_ABITANTI_MAX_AVVENTURA = 8;
/** Alias legacy (evita ReferenceError se un bundle HMR intermedio usa ancora i nomi vecchi). */
const NUM_ABITANTI_MIN = NUM_ABITANTI_MIN_CREATIVA;
const NUM_ABITANTI_MAX = NUM_ABITANTI_MAX_CREATIVA;

/** Razze (non umane) che devono avere almeno 1 adulto M e 1 adulta F a inizio partita (test). */
const RAZZE_COPPIA_ADULTI: Razza[] = ["Nano", "Scheletro", "Vampiro", "Goblin", "Orco", "Lucertoloide"];
const ETA_ADULTO_MIN = 18;

const PERSONALITÀ_POOL: { nome: string; peso: number }[] = [
  { nome: "Tiepido", peso: 35 },
  { nome: "Pollice Verde", peso: 10 },
  { nome: "Salutista", peso: 10 },
  { nome: "Empatico", peso: 10 },
  { nome: "Depresso", peso: 10 },
  { nome: "Carismatico", peso: 10 },
  { nome: "Psicopatico", peso: 5 },
  { nome: "Stakanovista", peso: 10 },
  { nome: "Omofobo", peso: 5 },
  { nome: "Razzista", peso: 5 },
  { nome: "Sessista", peso: 5 }
];

function pesaScelta<T>(pool: { nome: T; peso: number }[]): T {
  const totale = pool.reduce((s, p) => s + p.peso, 0);
  let r = Math.random() * totale;
  for (const p of pool) {
    r -= p.peso;
    if (r <= 0) return p.nome;
  }
  return pool[pool.length - 1].nome;
}

const RELIGIONI: Abitante["religione"][] = ["Ateo", "Deista", "Agnostico", "Culto del Sole", "Culto delle Ombre"];
const RAZZE_ALIENE: Razza[] = ["Elfo", "Nano", "Orco", "Goblin"];
const FAZIONI_RUOLO = ["Amministrazione", "Lavoratori", "Scienziati", "Esploratori", "Intellettuali", "Ambientalisti"];
const LAVORI = [
  "Disoccupato", "Ricercatore", "Medico", "Agricoltore", "Taglialegna", "Fabbro", "Minatore",
  "Esploratore", "Sicurezza", "Mago"
];
const EMOJI_UMANI_M: string[] = ["👨", "👨‍🔬", "👨‍💼", "👨‍🔧", "👨‍🌾"];
const EMOJI_UMANI_F: string[] = ["👩", "👩‍🔬", "👩‍💼", "👩‍🔧", "👩‍🌾"];

function normalizzaFazioni(fazioni: string[]): string[] {
  if (fazioni.includes("Schiavi")) return fazioni.filter((f) => f !== "Cittadini");
  return fazioni;
}

function abitanteBloccatoPerCoppiaRazza(a: Abitante): boolean {
  return (
    a.id === 1 ||
    a.razza === "Golem" ||
    a.lavoro === "Consigliere" ||
    a.lavoro === "Prigioniero" ||
    (a.reati?.includes("Ex Governatore") ?? false)
  );
}

/** Garantisce ≥1 maschio e ≥1 femmina adulti per ogni razza di test (convertono umani in eccesso). */
function assicurareCoppiaAdultiPerRazza(abitanti: Abitante[]): void {
  for (const razza of RAZZE_COPPIA_ADULTI) {
    for (const sesso of ["M", "F"] as const) {
      const giàPresente = abitanti.some(
        (a) => a.razza === razza && a.sesso === sesso && a.eta >= ETA_ADULTO_MIN
      );
      if (giàPresente) continue;

      const candidato =
        abitanti.find((a) => !abitanteBloccatoPerCoppiaRazza(a) && a.razza === "Umano") ??
        abitanti.find((a) => !abitanteBloccatoPerCoppiaRazza(a) && a.razza !== razza);

      if (!candidato) {
        throw new Error(`Generazione partita: slot insufficienti per ${razza} ${sesso}`);
      }

      candidato.razza = razza;
      candidato.specie = "alieno";
      candidato.sesso = sesso;
      if (candidato.eta < ETA_ADULTO_MIN) {
        candidato.eta = ETA_ADULTO_MIN + Math.floor(Math.random() * 40);
      }
      candidato.nome = generaNomeAlieno(razza);
      candidato.emoji = getEmojiRazza(razza);
    }
  }
}

/** Genera il regno iniziale casuale. Ogni partita usa questo risultato. */
export function generaColoniaIniziale(
  modalita: ModalitaGiocoGenerazione = "creativa"
): { abitanti: Abitante[]; razzaNativi: Razza } {
  const isAvventura = modalita === "avventura";
  const razzaNativi = RAZZE_ALIENE[Math.floor(Math.random() * RAZZE_ALIENE.length)];
  const nMin = isAvventura ? NUM_ABITANTI_MIN_AVVENTURA : NUM_ABITANTI_MIN;
  const nMax = isAvventura ? NUM_ABITANTI_MAX_AVVENTURA : NUM_ABITANTI_MAX;
  const n = nMin + Math.floor(Math.random() * (nMax - nMin + 1));
  const numSchiavi = isAvventura
    ? 0
    : 4 + Math.floor(Math.random() * Math.max(0, n - 1 - 4)); // almeno 4, massimo n-1 (Re id 1 escluso)
  const abitanti: Abitante[] = [];
  const indicesSchiavi = new Set<number>();
  while (indicesSchiavi.size < numSchiavi && n > 1) {
    indicesSchiavi.add(2 + Math.floor(Math.random() * (n - 1))); // id 2..n (id 1 = Re, mai schiavo)
  }

  for (let i = 1; i <= n; i++) {
    const èSchiavo = indicesSchiavi.has(i);
    // Re sempre umano; tutti gli altri umani a inizio partita (1 Nativo verrà impostato dopo il loop).
    const razza: Razza = "Umano";
    const isUmano = true;
    const specie: "umano" | "alieno" = "umano";
    const isRe = i === 1;
    const picked = isRe ? null : scegliNomeCognomeUmano();
    const nome = isRe ? "—" : picked!.nomeCompleto;
    const sesso = isRe ? undefined : picked!.sesso;
    const emoji = isRe
      ? "👑"
      : sesso === "M"
        ? EMOJI_UMANI_M[Math.floor(Math.random() * EMOJI_UMANI_M.length)]
        : EMOJI_UMANI_F[Math.floor(Math.random() * EMOJI_UMANI_F.length)];

    const fazioneRuolo = FAZIONI_RUOLO[Math.floor(Math.random() * FAZIONI_RUOLO.length)];
    const fazioni = èSchiavo ? [fazioneRuolo, "Schiavi"] : [fazioneRuolo, "Cittadini"];
    const fazioniNorm = normalizzaFazioni(fazioni);

    const lavoro = isRe ? LAVORO_GIOCATORE : LAVORI[Math.floor(Math.random() * LAVORI.length)];
    const competenzaBase = isRe ? 85 + Math.floor(Math.random() * 11) : 30 + Math.floor(Math.random() * 66);
    const competenza = Math.min(100, competenzaBase);
    const redditoBase =
      isRe
        ? STIPENDIO_BASE_MONETE_MESE * 2
        : lavoro === "Disoccupato"
          ? 0
          : redditoMensileLavoroDefault();
    const reddito = èSchiavo ? 0 : redditoBase;
    const crediti = 0;
    const spese = 0;

    const eta = isRe ? ETA_GIOCATORE_INIZIALE : 18 + Math.floor(Math.random() * 48);

    const ab: Abitante = {
      id: i,
      nome,
      emoji,
      eta,
      lavoro,
      competenza,
      produttività: 40 + Math.floor(Math.random() * 56),
      stanchezza: Math.floor(Math.random() * 61),
      personalità: pesaScelta(PERSONALITÀ_POOL),
      alimentazione: alimentazioneCasuale(),
      amici: [],
      rivali: [],
      fazioni: fazioniNorm,
      peso: 41 + Math.floor(Math.random() * 50),
      salute: 40 + Math.floor(Math.random() * 51),
      crediti,
      reddito,
      spese,
      paura: Math.floor(Math.random() * 41),
      felicità: 40 + Math.floor(Math.random() * 51),
      religione: RELIGIONI[Math.floor(Math.random() * RELIGIONI.length)],
      razza,
      specie,
      sesso,
      orientamento: isRe ? undefined : "Etero",
      specializzazione: specializzazioneCasuale()
    };
    const titolo = inferTitoloStudioPerEta(ab.eta, 18, ab.razza);
    if (titolo) ab.titoloStudio = titolo;
    if (èSchiavo) {
      ab.ruoloSchiavitu = "schiavo";
      ab.casta = "Servo della gleba";
    } else if (i === 1) {
      ab.casta = "Nobile";
    } else {
      ab.casta = "Cittadino";
    }
    abitanti.push(ab);
  }

  if (!isAvventura) {
    // Regola: 2-3 Nativi (razza = razzaNativi) integrati nel regno. La residenza iniziale per tutti (tranne Senzatetto) è nelle Capanne (useGameState).
    const candidatiNativo = abitanti.filter((a) => a.id !== 1);
    const numNativi = Math.min(candidatiNativo.length, 2 + Math.floor(Math.random() * 2)); // 2 o 3
    for (let k = candidatiNativo.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [candidatiNativo[k], candidatiNativo[j]] = [candidatiNativo[j], candidatiNativo[k]];
    }
    for (let i = 0; i < numNativi && i < candidatiNativo.length; i++) {
      const nat = candidatiNativo[i]!;
      nat.razza = razzaNativi;
      nat.specie = "alieno";
      nat.nome = generaNomeAlieno(razzaNativi);
      nat.emoji = getEmojiRazza(razzaNativi);
      nat.fazioni = normalizzaFazioni([...(nat.fazioni ?? []), "Nativi"]);
    }

    // Regola: esattamente 1 Robot a inizio partita (razza "Golem", nome stile Unit-XXXX). Fazione "Golem" automatica.
    // Robot non hanno Crediti, Reddito, Spese, Sesso, Salute, Peso, Paura. Orientamento sempre «Bi» (regola fondamentale).
    const candidatiRobot = abitanti.filter((a) => a.id !== 1 && a.razza === "Umano");
    if (candidatiRobot.length > 0) {
      const bot = candidatiRobot[Math.floor(Math.random() * candidatiRobot.length)];
      bot.razza = "Golem";
      bot.nome = generaNomeAlieno("Golem");
      bot.emoji = getEmojiRazza("Golem");
      bot.fazioni = normalizzaFazioni([...(bot.fazioni ?? []), "Golem"]);
      bot.crediti = 0;
      bot.reddito = 0;
      bot.spese = 0;
      bot.sesso = undefined;
      bot.orientamento = "Bi";
      bot.salute = 0;
      bot.peso = 0;
      bot.paura = 0;
    }
  }

  // Regola: 50% con Lavoro "Disoccupato" (il Re id 1 resta Re). Scegliamo floor(n/2) tra id 2..n.
  const numDisoccupati = Math.floor(n / 2);
  const indicesPerDisoccupato = abitanti.map((_, idx) => idx).filter((idx) => abitanti[idx].id !== 1);
  for (let k = indicesPerDisoccupato.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [indicesPerDisoccupato[k], indicesPerDisoccupato[j]] = [indicesPerDisoccupato[j], indicesPerDisoccupato[k]];
  }
  for (let d = 0; d < numDisoccupati && d < indicesPerDisoccupato.length; d++) {
    const ab = abitanti[indicesPerDisoccupato[d]];
    ab.lavoro = "Disoccupato";
    if (!ab.ruoloSchiavitu) ab.reddito = 0;
  }

  // Regola: almeno 1 Agricoltore a inizio partita (assegnato alla Serra in useGameState).
  const candidatiAgricoltore = abitanti.filter((a) => a.id !== 1);
  if (candidatiAgricoltore.length > 0) {
    const agr = candidatiAgricoltore[Math.floor(Math.random() * candidatiAgricoltore.length)];
    agr.lavoro = "Agricoltore";
    if (!agr.ruoloSchiavitu) agr.reddito = redditoMensileLavoroDefault();
  }

  let exGovernatoreId: number | null = null;
  if (!isAvventura) {
    // Regola: almeno 1 Prigioniero a inizio partita = Ex Governatore (Umano, reato "Ex Governatore"), assegnato al Campo di Lavoro; compare in Tribunale.
    const candidatiPrigioniero = abitanti.filter(
      (a) => a.id !== 1 && a.lavoro !== "Agricoltore" && a.razza === "Umano"
    );
    if (candidatiPrigioniero.length > 0) {
      const prig = candidatiPrigioniero[Math.floor(Math.random() * candidatiPrigioniero.length)];
      exGovernatoreId = prig.id;
      prig.lavoro = "Prigioniero";
      prig.razza = "Umano";
      prig.reati = ["Ex Governatore"];
      if (!prig.ruoloSchiavitu) prig.reddito = 0;
    }

    // Regola: 4 abitanti con fazione "Lealisti", tra cui l'ex governatore.
    const altriPerLealisti = abitanti.filter((a) => a.id !== 1 && a.id !== exGovernatoreId);
    for (let k = altriPerLealisti.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [altriPerLealisti[k], altriPerLealisti[j]] = [altriPerLealisti[j], altriPerLealisti[k]];
    }
    const lealistiIds = new Set<number>();
    if (exGovernatoreId != null) lealistiIds.add(exGovernatoreId);
    for (let i = 0; i < altriPerLealisti.length && lealistiIds.size < 4; i++) {
      lealistiIds.add(altriPerLealisti[i]!.id);
    }
    abitanti.forEach((a) => {
      if (lealistiIds.has(a.id)) {
        a.fazioni = normalizzaFazioni([...(a.fazioni ?? []), "Lealisti"]);
      }
    });

    // Regola: Rivoluzionari = Re (id 1) + 3 abitanti che hanno aiutato la Rivoluzione (escluso l'Ex Governatore).
    const candidatiRivoluzionari = abitanti.filter((a) => a.id !== 1 && a.id !== exGovernatoreId);
    for (let k = candidatiRivoluzionari.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [candidatiRivoluzionari[k], candidatiRivoluzionari[j]] = [candidatiRivoluzionari[j], candidatiRivoluzionari[k]];
    }
    const rivoluzionariIds = new Set<number>([1]);
    for (let i = 0; i < candidatiRivoluzionari.length && rivoluzionariIds.size < 4; i++) {
      rivoluzionariIds.add(candidatiRivoluzionari[i]!.id);
    }
    abitanti.forEach((a) => {
      if (rivoluzionariIds.has(a.id)) {
        a.fazioni = normalizzaFazioni([...(a.fazioni ?? []), "Rivoluzionari"]);
      }
    });
  } else {
    // Avventura: il Re parte come Rivoluzionario; il Consigliere viene aggiunto sotto.
    abitanti.forEach((a) => {
      if (a.id === 1) {
        a.fazioni = normalizzaFazioni([...(a.fazioni ?? []), "Rivoluzionari"]);
      }
    });
  }

  // Regola: 1 Omo, 2 Bi, il resto Etero (solo non-Robot; i Robot hanno sempre Bi, vedi sopra).
  const candidatiOrientamento = abitanti
    .map((_, idx) => idx)
    .filter((idx) => abitanti[idx]!.razza !== "Golem");
  for (let k = candidatiOrientamento.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [candidatiOrientamento[k], candidatiOrientamento[j]] = [candidatiOrientamento[j], candidatiOrientamento[k]];
  }
  if (candidatiOrientamento[0] != null) abitanti[candidatiOrientamento[0]]!.orientamento = "Omo";
  if (candidatiOrientamento[1] != null) abitanti[candidatiOrientamento[1]]!.orientamento = "Bi";
  if (candidatiOrientamento[2] != null) abitanti[candidatiOrientamento[2]]!.orientamento = "Bi";
  for (let i = 3; i < candidatiOrientamento.length; i++) {
    const idx = candidatiOrientamento[i];
    if (idx != null) abitanti[idx]!.orientamento = "Etero";
  }

  if (!isAvventura) {
    // Regola: almeno 1 Capo Spirituale (Clero) con religione Culto del Sole a inizio partita.
    // Ateo/Deista non possono diventare Fedeli: esclusi dalla scelta.
    const candidatiCapo = abitanti.filter(
      (a) => a.id !== 1 && a.razza !== "Golem" && puoDiventareFedeleCulto(a)
    );
    if (candidatiCapo.length > 0) {
      const capo = candidatiCapo[Math.floor(Math.random() * candidatiCapo.length)]!;
      capo.religione = "Culto del Sole";
      capo.lavoro = "Capo Spirituale";
      capo.casta = "Clero";
      capo.crediti = 0;
      capo.spese = 0;
      capo.reddito = 0;
    }
  }

  // Regola: 1 Consigliere iniziale (uomo umano 60 anni, pelato, barba bianca) nel Castello.
  const candidatiConsigliere = abitanti.filter(
    (a) =>
      a.id !== 1 &&
      a.razza === "Umano" &&
      a.sesso === "M" &&
      a.lavoro !== "Capo Spirituale" &&
      a.lavoro !== "Prigioniero" &&
      a.lavoro !== "Agricoltore"
  );
  const poolConsigliere =
    candidatiConsigliere.length > 0
      ? candidatiConsigliere
      : abitanti.filter(
          (a) =>
            a.id !== 1 &&
            a.razza !== "Golem" &&
            a.lavoro !== "Capo Spirituale" &&
            a.lavoro !== "Prigioniero" &&
            a.lavoro !== "Agricoltore"
        );
  if (poolConsigliere.length > 0) {
    const consigliere = poolConsigliere[Math.floor(Math.random() * poolConsigliere.length)]!;
    consigliere.lavoro = "Consigliere";
    consigliere.eta = CONSIGLIERE_ETA_INIZIALE;
    consigliere.sesso = "M";
    consigliere.razza = "Umano";
    const nomiM = NOMI_UMANI_CON_SESSO.filter((n) => n.sesso === "M");
    const nomeM = nomiM[Math.floor(Math.random() * nomiM.length)]!;
    const cognome = COGNOMI_UMANI[Math.floor(Math.random() * COGNOMI_UMANI.length)]!;
    consigliere.nome = `${nomeM.nome} ${cognome}`;
    if (!consigliere.ruoloSchiavitu) consigliere.reddito = redditoMensileLavoroDefault();
    if (isAvventura) {
      consigliere.fazioni = normalizzaFazioni([...(consigliere.fazioni ?? []), "Rivoluzionari"]);
    }
  }

  if (isAvventura) {
    // Avventura: 1 Edile (Ufficio Edile) + 2 Minatori (Miniera) + 1 Monetiere (Zecca),
    // oltre ad Agricoltore e Consigliere già impostati.
    const riservati = new Set(
      abitanti
        .filter(
          (a) =>
            a.id === 1 ||
            a.lavoro === "Consigliere" ||
            a.lavoro === "Agricoltore"
        )
        .map((a) => a.id)
    );
    const candidati = abitanti.filter((a) => !riservati.has(a.id));
    for (let k = candidati.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [candidati[k], candidati[j]] = [candidati[j], candidati[k]];
    }
    let i = 0;
    if (i < candidati.length) {
      const ab = candidati[i++]!;
      ab.lavoro = "Edile";
      if (!ab.ruoloSchiavitu) ab.reddito = redditoMensileLavoroDefault();
    }
    for (let m = 0; m < 2 && i < candidati.length; m++, i++) {
      const ab = candidati[i]!;
      ab.lavoro = "Minatore";
      if (!ab.ruoloSchiavitu) ab.reddito = redditoMensileLavoroDefault();
    }
    if (i < candidati.length) {
      const ab = candidati[i]!;
      ab.lavoro = "Monetiere";
      if (!ab.ruoloSchiavitu) ab.reddito = redditoMensileLavoroDefault();
    }
  }

  if (!isAvventura) {
    // Regola: 1 abitante con stato "Incinta" a inizio partita (preferibilmente donna, non Re, non Golem, non Consigliere)
    const candidatiIncinta = abitanti.filter(
      (a) => a.id !== 1 && a.razza !== "Golem" && a.lavoro !== "Consigliere"
    );
    if (candidatiIncinta.length > 0) {
      const femmine = candidatiIncinta.filter((a) => a.sesso === "F");
      const scelta = femmine.length > 0 ? femmine[Math.floor(Math.random() * femmine.length)]! : candidatiIncinta[Math.floor(Math.random() * candidatiIncinta.length)]!;
      scelta.incinta = true;
    }

    // Regola (test): almeno 1 adulto M e 1 adulta F per ogni razza attiva non umana (tranne Golem).
    assicurareCoppiaAdultiPerRazza(abitanti);
  }

  const listaFinale = isAvventura
    ? aggiungiCuginoNobileConSchiaviAvventura(abitanti)
    : abitanti;

  return {
    abitanti: listaFinale.map((abitante) =>
      abitanteConInventarioIniziale({
        ...abitante,
        ...(abitante.razza !== "Golem" &&
          !abitante.aspetto && {
          aspetto:
            abitante.lavoro === "Consigliere"
              ? creaAspettoConsigliereIniziale()
              : generaAspettoCasuale(abitante.razza ?? "Umano", Math.random, {
                  eta: abitante.eta,
                  sesso: abitante.sesso,
                  professione: abitante.lavoro
                })
        })
      })
    ),
    razzaNativi
  };
}
