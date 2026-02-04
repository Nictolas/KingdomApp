import type { Abitante, Razza } from "../types";
import { pianetiData, getEmojiRazza } from "../kingdomData";
import { generaNomeAlieno } from "./nomiAlieni";

/** Regole di generazione casuale della colonia iniziale (per la pagina "Generazione Partita"). */
export const REGOLE_GENERAZIONE_PARTITA: { titolo: string; punti: string[] }[] = [
  {
    titolo: "Numero abitanti",
    punti: [
      "La colonia iniziale ha tra 15 e 22 abitanti (numero estratto a caso)."
    ]
  },
  {
    titolo: "Razza",
    punti: [
      "Il Comandante della Colonia è sempre di razza umana.",
      "A parte 1 Nativo iniziale, tutti gli abitanti sono a inizio partita di razza umana.",
      "La razza dei Nativi (per l’evento Assimilazione) è scelta a caso tra le razze non umane.",
      "Ogni partita deve partire con 1 Nativo tra gli abitanti (razza = razza Nativi del pianeta).",
      "Ogni partita deve partire con 1 abitante di razza Robot."
    ]
  },
  {
    titolo: "Personalità",
    punti: [
      "Solo personalità del catalogo: Pollice Verde, Salutista, Empatico, Depresso, Carismatico, Psicopatico, Stakanovista, Tiepido, Omofobo, Razzista.",
      "Distribuzione: circa 35% Tiepido, il resto distribuito in modo uniforme tra le altre sette."
    ]
  },
  {
    titolo: "Religione",
    punti: [
      "Distribuzione uniforme tra: Ateo, Deista, Agnostico, Culto del Sole, Culto degli Alieni."
    ]
  },
  {
    titolo: "Fazioni e ruoli",
    punti: [
      "Ogni abitante ha sempre la fazione «Cittadini» più una di: Amministrazione, Lavoratori, Scienziati, Esploratori (scelta a caso).",
      "Almeno 4 abitanti sono «Schiavi»: hanno fazione Schiavi (e non Cittadini), ruoloSchiavitu «schiavo», crediti/reddito/spese a 0.",
      "4 abitanti hanno la fazione «Reazionari», tra cui l'ex governatore (prigioniero in Tribunale).",
      "Il Comandante e 3 altri abitanti (escluso l'Ex Governatore) hanno la fazione «Rivoluzionari»: chi ha fatto la Rivoluzione.",
      "Ci sono alcuni Immigrati fin da inizio partita."
    ]
  },
  {
    titolo: "Nome ed emoji",
    punti: [
      "Umani: nome e cognome da liste fisse (es. Marco Rossi, Anna Bianchi).",
      "Alieni: nome tipo «Razza-XXXX» (numero casuale). Emoji: per razza (👤 umano, 👽 Grigi, ecc.)."
    ]
  },
  {
    titolo: "Statistiche (range)",
    punti: [
      "Età: 18–65 anni.",
      "Competenza: 30–95. Produttività: 40–95. Stanchezza: 0–60.",
      "Peso: 41–90. Salute: 40–90. Crediti: 500–1500 (0 se schiavo). Reddito e spese: 0–500 (0 se schiavo).",
      "Lealtà: 30–95. Paura: 0–40. Felicità: 40–90."
    ]
  },
  {
    titolo: "Lavoro",
    punti: [
      "Il primo abitante (id 1) è «Comandante della Colonia» con competenza alta.",
      "Il 50% degli abitanti deve avere come Lavoro «Disoccupato»; il restante a caso tra: Tecnico, Ricercatore, Ingegnere, Medico, Agricoltore, Meccanico, Esploratore, Comunicatore, Sicurezza, Amministratore.",
      "A inizio partita c'è almeno 1 lavoratore assegnato alla Serra: un abitante con Lavoro «Agricoltore».",
      "A inizio partita c'è almeno 1 abitante con Lavoro «Prigioniero»: è l'Ex Governatore (Razza Umano, reato «Ex Governatore»), assegnato al Campo di Lavoro; compare in Tribunale."
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
      "Ogni abitante ha Sesso M o F (assegnato a caso).",
      "A inizio partita: 1 abitante con Orientamento «Omo», 2 con «Bi», il resto con «Etero»."
    ]
  },
  {
    titolo: "Relazioni",
    punti: [
      "Amici e rivali iniziali: vuoti (nessun legame predefinito)."
    ]
  }
];

const NUM_ABITANTI_MIN = 15;
const NUM_ABITANTI_MAX = 22;

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
  { nome: "Razzista", peso: 5 }
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

const RELIGIONI: Abitante["religione"][] = ["Ateo", "Deista", "Agnostico", "Culto del Sole", "Culto degli Alieni"];
const RAZZE_ALIENE: Razza[] = ["Grigi", "Nordici", "Rettiliani", "Insettoidi", "Marini", "Ferini"];
const FAZIONI_RUOLO = ["Amministrazione", "Lavoratori", "Scienziati", "Esploratori"];
const LAVORI = [
  "Disoccupato", "Tecnico", "Ricercatore", "Ingegnere", "Medico", "Agricoltore",
  "Meccanico", "Esploratore", "Comunicatore", "Sicurezza", "Amministratore"
];
const NOMI_UMANI = ["Marco", "Luca", "Anna", "Sofia", "Giovanni", "Elena", "Alessandro", "Chiara", "Francesco", "Maria", "Andrea", "Laura"];
const COGNOMI_UMANI = ["Rossi", "Bianchi", "Verdi", "Neri", "Blu", "Gialli", "Ferrari", "Romano", "Colombo", "Ricci"];
const EMOJI_UMANI = ["👨", "👩", "👨‍🔬", "👩‍🔬", "👨‍💼", "👩‍💼", "👨‍🔧", "👩‍🔧", "👨‍🌾", "👩‍🌾"];

function normalizzaFazioni(fazioni: string[]): string[] {
  if (fazioni.includes("Schiavi")) return fazioni.filter((f) => f !== "Cittadini");
  return fazioni;
}

/** Genera la colonia iniziale casuale. Ogni partita usa questo risultato (non abitantiData). */
export function generaColoniaIniziale(): { abitanti: Abitante[]; razzaNativi: Razza } {
  const razzaNativi = RAZZE_ALIENE[Math.floor(Math.random() * RAZZE_ALIENE.length)];
  const n = NUM_ABITANTI_MIN + Math.floor(Math.random() * (NUM_ABITANTI_MAX - NUM_ABITANTI_MIN + 1));
  const numSchiavi = 4 + Math.floor(Math.random() * Math.max(0, n - 1 - 4)); // almeno 4, massimo n-1 (Comandante id 1 escluso)
  const abitanti: Abitante[] = [];
  const indicesSchiavi = new Set<number>();
  while (indicesSchiavi.size < numSchiavi && n > 1) {
    indicesSchiavi.add(2 + Math.floor(Math.random() * (n - 1))); // id 2..n (id 1 = Comandante, mai schiavo)
  }

  for (let i = 1; i <= n; i++) {
    const èSchiavo = indicesSchiavi.has(i);
    // Comandante sempre umano; tutti gli altri umani a inizio partita (1 Nativo verrà impostato dopo il loop).
    const razza: Razza = "Umano";
    const isUmano = true;
    const specie: "umano" | "alieno" = "umano";
    const sesso: "M" | "F" = Math.random() >= 0.5 ? "M" : "F";
    const nome = `${NOMI_UMANI[Math.floor(Math.random() * NOMI_UMANI.length)]} ${COGNOMI_UMANI[Math.floor(Math.random() * COGNOMI_UMANI.length)]}`;
    const emoji = EMOJI_UMANI[Math.floor(Math.random() * EMOJI_UMANI.length)];

    const fazioneRuolo = FAZIONI_RUOLO[Math.floor(Math.random() * FAZIONI_RUOLO.length)];
    const fazioni = èSchiavo ? [fazioneRuolo, "Schiavi"] : [fazioneRuolo, "Cittadini"];
    const fazioniNorm = normalizzaFazioni(fazioni);

    const lavoro =
      i === 1
        ? "Comandante della Colonia"
        : LAVORI[Math.floor(Math.random() * LAVORI.length)];
    const competenzaBase = i === 1 ? 85 + Math.floor(Math.random() * 11) : 30 + Math.floor(Math.random() * 66);
    const competenza = Math.min(100, competenzaBase);
    const redditoBase = i === 1 ? 1500 + Math.floor(Math.random() * 501) : lavoro === "Disoccupato" ? 0 : 100 + Math.floor(Math.random() * 500);
    const reddito = èSchiavo ? 0 : redditoBase;
    const crediti = èSchiavo ? 0 : 500 + Math.floor(Math.random() * 1001);
    const spese = èSchiavo ? 0 : 50 + Math.floor(Math.random() * 451);

    const ab: Abitante = {
      id: i,
      nome,
      emoji,
      eta: 18 + Math.floor(Math.random() * 48),
      lavoro,
      competenza,
      produttività: 40 + Math.floor(Math.random() * 56),
      stanchezza: Math.floor(Math.random() * 61),
      personalità: pesaScelta(PERSONALITÀ_POOL),
      amici: [],
      rivali: [],
      fazioni: fazioniNorm,
      peso: 41 + Math.floor(Math.random() * 50),
      salute: 40 + Math.floor(Math.random() * 51),
      crediti,
      reddito,
      spese,
      lealtà: 30 + Math.floor(Math.random() * 66),
      paura: Math.floor(Math.random() * 41),
      felicità: 40 + Math.floor(Math.random() * 51),
      religione: RELIGIONI[Math.floor(Math.random() * RELIGIONI.length)],
      razza,
      specie,
      sesso,
      orientamento: "Etero"
    };
    if (èSchiavo) {
      ab.ruoloSchiavitu = "schiavo";
    }
    abitanti.push(ab);
  }

  // Regola: esattamente 1 Nativo (razza = razzaNativi) integrato in colonia. Scegliamo un abitante con id !== 1 (non il Comandante).
  const candidatiNativo = abitanti.filter((a) => a.id !== 1);
  if (candidatiNativo.length > 0) {
    const nat = candidatiNativo[Math.floor(Math.random() * candidatiNativo.length)];
    nat.razza = razzaNativi;
    nat.specie = "alieno";
    nat.nome = generaNomeAlieno(razzaNativi);
    nat.emoji = getEmojiRazza(razzaNativi);
    // Nativo integrato: deve avere la fazione "Nativi" così appare in /nativi e in colonna Fazione in /abitanti.
    nat.fazioni = normalizzaFazioni([...(nat.fazioni ?? []), "Nativi"]);
  }

  // Regola: esattamente 1 Robot a inizio partita (razza "Robot", nome stile Unit-XXXX). Fazione "Robots" automatica.
  // Robot non hanno Crediti, Reddito, Spese, Sesso, Orientamento, Salute, Peso, Paura, Lealtà.
  const candidatiRobot = abitanti.filter((a) => a.id !== 1 && a.razza === "Umano");
  if (candidatiRobot.length > 0) {
    const bot = candidatiRobot[Math.floor(Math.random() * candidatiRobot.length)];
    bot.razza = "Robot";
    bot.nome = generaNomeAlieno("Robot");
    bot.emoji = getEmojiRazza("Robot");
    bot.fazioni = normalizzaFazioni([...(bot.fazioni ?? []), "Robots"]);
    bot.crediti = 0;
    bot.reddito = 0;
    bot.spese = 0;
    bot.sesso = undefined;
    bot.orientamento = undefined;
    bot.salute = 0;
    bot.peso = 0;
    bot.paura = 0;
    bot.lealtà = 0;
  }

  // Regola: 50% con Lavoro "Disoccupato" (il Comandante id 1 resta Comandante). Scegliamo floor(n/2) tra id 2..n.
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
    if (!agr.ruoloSchiavitu) agr.reddito = 100 + Math.floor(Math.random() * 400);
  }

  // Regola: almeno 1 Prigioniero a inizio partita = Ex Governatore (Umano, reato "Ex Governatore"), assegnato al Campo di Lavoro; compare in Tribunale.
  let exGovernatoreId: number | null = null;
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

  // Regola: 4 abitanti con fazione "Reazionari", tra cui l'ex governatore.
  const altriPerReazionari = abitanti.filter((a) => a.id !== 1 && a.id !== exGovernatoreId);
  for (let k = altriPerReazionari.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [altriPerReazionari[k], altriPerReazionari[j]] = [altriPerReazionari[j], altriPerReazionari[k]];
  }
  const reazionariIds = new Set<number>();
  if (exGovernatoreId != null) reazionariIds.add(exGovernatoreId);
  for (let i = 0; i < altriPerReazionari.length && reazionariIds.size < 4; i++) {
    reazionariIds.add(altriPerReazionari[i]!.id);
  }
  abitanti.forEach((a) => {
    if (reazionariIds.has(a.id)) {
      a.fazioni = normalizzaFazioni([...(a.fazioni ?? []), "Reazionari"]);
    }
  });

  // Regola: Rivoluzionari = Comandante (id 1) + 3 abitanti che hanno aiutato la Rivoluzione (escluso l'Ex Governatore).
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

  // Regola: 1 Omo, 2 Bi, il resto Etero.
  const candidatiOrientamento = abitanti.map((_, idx) => idx);
  for (let k = candidatiOrientamento.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [candidatiOrientamento[k], candidatiOrientamento[j]] = [candidatiOrientamento[j], candidatiOrientamento[k]];
  }
  abitanti[candidatiOrientamento[0]!]!.orientamento = "Omo";
  if (abitanti.length > 1) abitanti[candidatiOrientamento[1]!]!.orientamento = "Bi";
  if (abitanti.length > 2) abitanti[candidatiOrientamento[2]!]!.orientamento = "Bi";
  for (let i = 3; i < abitanti.length; i++) {
    abitanti[candidatiOrientamento[i]!]!.orientamento = "Etero";
  }

  // Regola: 1 abitante con stato "Incinta" a inizio partita (preferibilmente donna, non Comandante, non Robot)
  const candidatiIncinta = abitanti.filter((a) => a.id !== 1 && a.razza !== "Robot");
  if (candidatiIncinta.length > 0) {
    const femmine = candidatiIncinta.filter((a) => a.sesso === "F");
    const scelta = femmine.length > 0 ? femmine[Math.floor(Math.random() * femmine.length)]! : candidatiIncinta[Math.floor(Math.random() * candidatiIncinta.length)]!;
    scelta.incinta = true;
  }

  return { abitanti, razzaNativi };
}
