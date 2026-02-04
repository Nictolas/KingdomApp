import type { Abitante, Risorsa, Edificio, OrdineMercato, EventoInCorso } from "../types";
import { EVENTI_CATALOGO } from "./eventi/index";
import { getConsumoCibo, getConsumoAcqua, getProduzioneCiboPerAbitante } from "./ciboConsumo";
import { RESIDENZE_CATALOGO, RESIDENZE_ENERGIA_PER_ABITANTE } from "../data/residenzeData";

export type AvanzaMeseInput = {
  abitanti: Abitante[];
  edifici: Edificio[];
  risorse: Risorsa[];
  ordiniMercato: OrdineMercato[];
  eventiInCorso: EventoInCorso[];
  mese: number;
  anno: number;
  divietoEspatrioAttivo: boolean;
  punteggioSanzioni: number;
  calcolaFelicitàModificata: (a: Abitante) => number;
  politicaNascite: "figlio-unico" | "incentivi" | "nessuna";
  /** Prossimo ID disponibile per nuovi abitanti (es. neonati). */
  nextId: number;
  /** Età alla quale l'abitante diventa Pensionato (non lavora, riceve assegno mensile). */
  etaPensionabile: number;
  /** Assegno mensile in crediti dato a ogni pensionato. */
  assegnoPensionati: number;
  /** Soddisfazione 1-100 per fazioni tracciate (es. Rivoluzionari). */
  soddisfazioneFazioni?: Record<string, number>;
  /** Prezzo mensile (crediti) per tipo di residenza. Se assente si usa il default del catalogo. */
  prezzoResidenze?: Record<string, number>;
  /** Importo mensile del Reddito di Cittadinanza per ogni disoccupato non schiavo. */
  redditoCittadinanza?: number;
  /** Modalità del sistema sanitario (Privata/Pubblica) per i costi dell'Ospedale. */
  modalitaSanita?: "privata" | "pubblica";
};

export type AvanzaMeseOutput = {
  abitanti: Abitante[];
  edifici: Edificio[];
  risorse: Risorsa[];
  eventiInCorso: EventoInCorso[];
  nuovoMese: number;
  nuovoAnno: number;
  deltaNativiNonIntegrati: number;
  pendingAssimilazione: number | null;
  /** Vittime di omicidio per rivalità (per mostrare alert). */
  vittimeOmicidi: { nome: string }[];
  /** Coppia con amicizia >= 90 che chiede di sposarsi (compatibili per orientamento/sesso). */
  pendingMatrimonio: { idA: number; idB: number; nomeA: string; nomeB: string } | null;
  /** Messaggio da mostrare in home quando si attiva l'evento Emigrazione (es. "Alessandro Ricci ha lasciato la colonia."). */
  messaggioEmigrazione: string | null;
  /** Abitante appena incinta (concepimento questo mese): mostra avviso "X è incinta.". */
  pendingGravidanza: { id: number; nome: string } | null;
  /** Messaggio nascita: "È nato [nome]. Genitori: X e Y." */
  messaggioNascita: string | null;
  /** ID assegnato al neonato (se creato); il hook deve fare setNextId(value + 1). */
  newIdNascita: number | null;
  /** Avviso da appendere al Diario (es. rischio Guerra Civile). */
  avvisoDiario: string | null;
};

/** Compatibilità matrimonio: Omo solo con Omo/Bi stesso sesso; Etero con Etero/Bi sesso opposto; Bi con chiunque. */
export function canMarry(a: Abitante, b: Abitante): boolean {
  const sessoA = a.sesso ?? "M";
  const sessoB = b.sesso ?? "M";
  const orA = a.orientamento ?? "Etero";
  const orB = b.orientamento ?? "Etero";
  const stessoSesso = sessoA === sessoB;
  if (orA === "Omo") return (orB === "Omo" || orB === "Bi") && stessoSesso;
  if (orA === "Etero") return (orB === "Etero" || orB === "Bi") && !stessoSesso;
  if (orA === "Bi") return true; // Bi con chiunque
  return false;
}

const SOGLIA_AMICIZIA_MATRIMONIO = 90;

/** True se esiste almeno una coppia (non sposata, amicizia ≥90, compatibile) che può generare pendingMatrimonio allo Skip Mese. */
export function esisteCoppiaMatrimonioPossibile(abitanti: Abitante[]): boolean {
  for (const a of abitanti) {
    if (a.coniugeId != null) continue;
    for (const rel of a.amici ?? []) {
      if (rel.punteggio < SOGLIA_AMICIZIA_MATRIMONIO) continue;
      const b = abitanti.find((x) => x.id === rel.id);
      if (!b || b.coniugeId != null || a.id >= b.id) continue;
      if (!canMarry(a, b) || !canMarry(b, a)) continue;
      return true;
    }
  }
  return false;
}

/**
 * Logica pura di avanzamento mese: dato lo stato attuale e la config, restituisce il nuovo stato.
 * Nessun side-effect; il hook applicherà gli aggiornamenti e pulirà gli ordini mercato.
 */
export function runAvanzaMese(input: AvanzaMeseInput): AvanzaMeseOutput {
  const {
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
    soddisfazioneFazioni = {},
    prezzoResidenze = {},
    redditoCittadinanza = 0,
    modalitaSanita = "privata"
  } = input;

  const nuovoMese = mese === 12 ? 1 : mese + 1;
  const nuovoAnno = mese === 12 ? anno + 1 : anno;
  const avanzaAnno = nuovoAnno > anno;

  let abitantiRimasti = abitanti;

  // Omicidi per rivalità: coppie con punteggio rivalità >= 90 (o >= 60 se uno è Psicopatico), 50% probabilità che uno uccida l'altro
  const SOGLIA_RIVALITÀ = 90;
  const SOGLIA_PSICOPATICO = 60;
  const vittimeOmicidi: { nome: string }[] = [];
  const idsVittime = new Set<number>();
  const coppieElaborate = new Set<string>();
  for (const A of abitantiRimasti) {
    for (const rivale of A.rivali ?? []) {
      const B = abitantiRimasti.find((b) => b.id === rivale.id);
      if (!B || A.id >= B.id) continue; // elabora ogni coppia una sola volta
      const soglia = A.personalità === "Psicopatico" || B.personalità === "Psicopatico" ? SOGLIA_PSICOPATICO : SOGLIA_RIVALITÀ;
      if (rivale.punteggio < soglia) continue;
      const key = `${A.id}-${B.id}`;
      if (coppieElaborate.has(key)) continue;
      coppieElaborate.add(key);
      if (Math.random() >= 0.5) continue; // 50% probabilità che avvenga l'omicidio
      const vittima = Math.random() < 0.5 ? A : B;
      vittimeOmicidi.push({ nome: vittima.nome });
      idsVittime.add(vittima.id);
    }
  }
  abitantiRimasti = abitantiRimasti.filter((a) => !idsVittime.has(a.id));

  // Rimuovi riferimenti ai morti (amici, rivali, coniugeId, figliIds, genitoriIds, nonniIds)
  const idsVivi = new Set(abitantiRimasti.map((a) => a.id));
  const rimuoviMorti = (ids: number[]) => (ids ?? []).filter((id) => idsVivi.has(id));
  const rimuoviMortiRel = (rel: { id: number; punteggio: number }[]) => (rel ?? []).filter((r) => idsVivi.has(r.id));
  abitantiRimasti = abitantiRimasti.map((a) => ({
    ...a,
    amici: rimuoviMortiRel(a.amici),
    rivali: rimuoviMortiRel(a.rivali),
    coniugeId: a.coniugeId != null && idsVivi.has(a.coniugeId) ? a.coniugeId : undefined,
    figliIds: rimuoviMorti(a.figliIds ?? []),
    genitoriIds: rimuoviMorti(a.genitoriIds ?? []),
    nonniIds: rimuoviMorti(a.nonniIds ?? [])
  }));

  // Rapporti stesso edificio: coppie assegnate allo stesso edificio sviluppano Amicizia o Rivalità (punteggio 10) se non già presenti
  edifici.forEach((edificio) => {
    const ids = (edificio.abitantiAssegnati ?? []).filter((id) => idsVivi.has(id));
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const idA = ids[i];
        const idB = ids[j];
        const a = abitantiRimasti.find((x) => x.id === idA);
        const b = abitantiRimasti.find((x) => x.id === idB);
        if (!a || !b) continue;
        const haGià = (arr: { id: number }[] | undefined, id: number) => (arr ?? []).some((r) => r.id === id);
        if (haGià(a.amici, idB) || haGià(a.rivali, idB)) continue;
        const èAmicizia = Math.random() >= 0.5;
        if (èAmicizia) {
          a.amici.push({ id: idB, punteggio: 10 });
          b.amici.push({ id: idA, punteggio: 10 });
        } else {
          a.rivali.push({ id: idB, punteggio: 10 });
          b.rivali.push({ id: idA, punteggio: 10 });
        }
      }
    }
  });

  // Aggiorna rapporti mensili: ogni rapporto varia di un punteggio casuale da -10 a +10; se <= 0 si trasforma (amicizia↔rivalità) e riparte da 10.
  // Eccezione Omofobo: se uno è Omofobo e l'altro Omo/Bi e hanno lo stesso Lavoro (stesso edificio), solo +0–5 Rivalità.
  const isOmofoboOmoBiStessoLavoro = (x: Abitante, y: Abitante) =>
    x.lavoro === y.lavoro &&
    ((x.personalità === "Omofobo" && (y.orientamento === "Omo" || y.orientamento === "Bi")) ||
      (y.personalità === "Omofobo" && (x.orientamento === "Omo" || x.orientamento === "Bi")));
  // Eccezione Razzista: se uno è Razzista e l'altro ha Razza diversa e hanno lo stesso Lavoro, solo +0–5 Rivalità.
  const razzaX = (x: Abitante) => x.razza ?? "Umano";
  const isRazzistaRazzaDiversaStessoLavoro = (x: Abitante, y: Abitante) =>
    x.lavoro === y.lavoro &&
    razzaX(x) !== razzaX(y) &&
    (x.personalità === "Razzista" || y.personalità === "Razzista");

  type CoppiaRapporto = { idA: number; idB: number; tipo: "amici" | "rivali"; punteggio: number };
  const coppieRapporto: CoppiaRapporto[] = [];
  abitantiRimasti.forEach((a) => {
    (a.amici ?? []).forEach((rel) => {
      if (rel.id > a.id) coppieRapporto.push({ idA: a.id, idB: rel.id, tipo: "amici", punteggio: rel.punteggio });
    });
    (a.rivali ?? []).forEach((rel) => {
      if (rel.id > a.id) coppieRapporto.push({ idA: a.id, idB: rel.id, tipo: "rivali", punteggio: rel.punteggio });
    });
  });
  const getAb = (id: number) => abitantiRimasti.find((x) => x.id === id)!;
  const rimuoviRel = (arr: { id: number; punteggio: number }[], otherId: number) => {
    const idx = (arr ?? []).findIndex((r) => r.id === otherId);
    if (idx >= 0) arr!.splice(idx, 1);
  };
  coppieRapporto.forEach(({ idA, idB, tipo, punteggio }) => {
    const a = getAb(idA);
    const b = getAb(idB);
    if (!a || !b) return;

    if (isOmofoboOmoBiStessoLavoro(a, b)) {
      // Solo +0–5 Rivalità: niente amicizia, solo rivalità che aumenta
      const addRivalità = Math.floor(Math.random() * 6); // 0–5
      rimuoviRel(a.amici!, idB);
      rimuoviRel(b.amici!, idA);
      const rivA = a.rivali?.find((r) => r.id === idB);
      const rivB = b.rivali?.find((r) => r.id === idA);
      const nuovoPunteggioRivalità = Math.min(100, (rivA?.punteggio ?? 0) + addRivalità);
      if (rivA) rivA.punteggio = nuovoPunteggioRivalità;
      else {
        a.rivali = a.rivali ?? [];
        a.rivali.push({ id: idB, punteggio: nuovoPunteggioRivalità });
      }
      if (rivB) rivB.punteggio = nuovoPunteggioRivalità;
      else {
        b.rivali = b.rivali ?? [];
        b.rivali.push({ id: idA, punteggio: nuovoPunteggioRivalità });
      }
      return;
    }
    if (isRazzistaRazzaDiversaStessoLavoro(a, b)) {
      // Come Omofobo: solo +0–5 Rivalità (razza diversa)
      const addRivalità = Math.floor(Math.random() * 6); // 0–5
      rimuoviRel(a.amici!, idB);
      rimuoviRel(b.amici!, idA);
      const rivA = a.rivali?.find((r) => r.id === idB);
      const rivB = b.rivali?.find((r) => r.id === idA);
      const nuovoPunteggioRivalità = Math.min(100, (rivA?.punteggio ?? 0) + addRivalità);
      if (rivA) rivA.punteggio = nuovoPunteggioRivalità;
      else {
        a.rivali = a.rivali ?? [];
        a.rivali.push({ id: idB, punteggio: nuovoPunteggioRivalità });
      }
      if (rivB) rivB.punteggio = nuovoPunteggioRivalità;
      else {
        b.rivali = b.rivali ?? [];
        b.rivali.push({ id: idA, punteggio: nuovoPunteggioRivalità });
      }
      return;
    }

    const delta = Math.floor(Math.random() * 21) - 10;
    const nuovoPunteggio = punteggio + delta;
    if (nuovoPunteggio <= 0) {
      if (tipo === "amici") {
        rimuoviRel(a.amici!, idB);
        rimuoviRel(b.amici!, idA);
        a.rivali = a.rivali ?? [];
        b.rivali = b.rivali ?? [];
        a.rivali.push({ id: idB, punteggio: 10 });
        b.rivali.push({ id: idA, punteggio: 10 });
      } else {
        rimuoviRel(a.rivali!, idB);
        rimuoviRel(b.rivali!, idA);
        a.amici = a.amici ?? [];
        b.amici = b.amici ?? [];
        a.amici.push({ id: idB, punteggio: 10 });
        b.amici.push({ id: idA, punteggio: 10 });
      }
    } else {
      const listA = tipo === "amici" ? a.amici! : a.rivali!;
      const listB = tipo === "amici" ? b.amici! : b.rivali!;
      const relA = listA.find((r) => r.id === idB);
      const relB = listB.find((r) => r.id === idA);
      if (relA) relA.punteggio = nuovoPunteggio;
      if (relB) relB.punteggio = nuovoPunteggio;
    }
  });

  // Invecchiamento: +1 anno quando si cambia anno
  const idsPensionati = new Set<number>();

  // Aggiorna abitanti (invecchiamento, pensionamento, schiavi vs non-schiavi, crediti, stanchezza, peso, salute)
  const nuoviAbitanti = abitantiRimasti.map((abitante) => {
    let eta = abitante.eta;
    if (avanzaAnno) eta += 1;

    let lavoro = abitante.lavoro;
    let reddito = abitante.reddito;
    if (
      eta >= etaPensionabile &&
      lavoro !== "Comandante della Colonia" &&
      lavoro !== "Neonato" &&
      lavoro !== "Pensionato"
    ) {
      lavoro = "Pensionato";
      reddito = assegnoPensionati;
      idsPensionati.add(abitante.id);
    }

    const èSchiavo = abitante.fazioni?.includes("Schiavi") ?? false;
    if (èSchiavo) {
      const nuovaStanchezza = Math.min(100, abitante.stanchezza + Math.floor(Math.random() * 10));
      const variazionePeso = Math.floor(Math.random() * 6) - 2;
      const nuovoPeso = Math.max(0, Math.min(100, abitante.peso + variazionePeso));
      const variazioneSalute = Math.floor(Math.random() * 6) - 2;
      const nuovaSalute = Math.max(0, Math.min(100, abitante.salute + variazioneSalute));
      return {
        ...abitante,
        eta,
        lavoro,
        reddito,
        crediti: 0,
        spese: 0,
        stanchezza: nuovaStanchezza,
        peso: nuovoPeso,
        salute: nuovaSalute
      };
    }
    // Reddito di cittadinanza per disoccupati non schiavi
    if (lavoro === "Disoccupato" && !èSchiavo && redditoCittadinanza > 0) {
      reddito = redditoCittadinanza;
    }

    const redditoEffettivo = lavoro === "Disoccupato" ? 0 : reddito;

    // Risparmio: di base 10% del reddito, 0 se Spendaccione, 50% se Tirchio
    let risparmio = 0;
    if (redditoEffettivo > 0) {
      if (abitante.personalità === "Spendaccione") {
        risparmio = 0;
      } else if (abitante.personalità === "Tirchio") {
        risparmio = Math.floor(redditoEffettivo * 0.5);
      } else {
        risparmio = Math.floor(redditoEffettivo * 0.1);
      }
    }

    const nuovoSaldo = abitante.crediti + redditoEffettivo - abitante.spese + risparmio;
    const nuovaStanchezza = Math.min(100, abitante.stanchezza + Math.floor(Math.random() * 10));
    const variazionePeso = Math.floor(Math.random() * 6) - 2;
    const nuovoPeso = Math.max(0, Math.min(100, abitante.peso + variazionePeso));
    const variazioneSalute = Math.floor(Math.random() * 6) - 2;
    const nuovaSalute = Math.max(0, Math.min(100, abitante.salute + variazioneSalute));
    return {
      ...abitante,
      eta,
      lavoro,
      reddito: lavoro === "Disoccupato" ? 0 : reddito,
      crediti: Math.max(0, nuovoSaldo),
      stanchezza: nuovaStanchezza,
      peso: nuovoPeso,
      salute: nuovaSalute
    };
  });

  // Aggiorna edifici (rimuovi pensionati dalle assegnazioni, variazione efficienza se operativo)
  const nuoviEdifici = edifici.map((edificio) => {
    const abitantiAssegnatiSenzaPensionati = (edificio.abitantiAssegnati ?? []).filter(
      (id) => !idsPensionati.has(id)
    );
    const occupazioneAggiornata =
      abitantiAssegnatiSenzaPensionati.length !== (edificio.abitantiAssegnati?.length ?? 0)
        ? abitantiAssegnatiSenzaPensionati.length
        : edificio.occupazione;
    let out = edificio;
    if (abitantiAssegnatiSenzaPensionati.length !== (edificio.abitantiAssegnati?.length ?? 0)) {
      out = { ...edificio, abitantiAssegnati: abitantiAssegnatiSenzaPensionati, occupazione: occupazioneAggiornata };
    }
    if (out.stato === "Operativo") {
      const variazioneEfficienza = Math.floor(Math.random() * 6) - 2;
      const nuovaEfficienza = Math.max(50, Math.min(100, out.efficienza + variazioneEfficienza));
      return { ...out, efficienza: nuovaEfficienza };
    }
    return out;
  });

  // Aggiorna risorse (crediti, produzione/consumo edifici, consumo cibo, bonus ministro agricoltura)
  const nuoveRisorse = risorse.map((risorsa) => {
    let nuovaQuantità = risorsa.quantità;
    let totaleCiboProdotto = 0;

    if (risorsa.nome === "Crediti") {
      const totaleRedditi = nuoviAbitanti
        .filter((a) => a.lavoro !== "Pensionato")
        .reduce((sum, a) => sum + a.reddito, 0);
      const totaleSpese = nuoviAbitanti.reduce((sum, a) => sum + a.spese, 0);
      const totaleStipendiEdifici = nuoviEdifici
        .filter((e) => e.stato === "Operativo")
        .reduce((sum, e) => {
          // Se la sanità è privata, gli stipendi dell'Ospedale non pesano sul bilancio della colonia
          if (modalitaSanita === "privata" && e.nome === "Ospedale Coloniale") {
            return sum;
          }
          return sum + (e.stipendioPerLavoratore ?? 0) * (e.abitantiAssegnati?.length ?? 0);
        }, 0);
      const numPensionati = nuoviAbitanti.filter((a) => a.lavoro === "Pensionato").length;
      const costoPensioni = numPensionati * assegnoPensionati;
      const entrateResidenze = nuoviEdifici
        .filter((e) => e.tipo === "Residenza" && e.stato === "Operativo")
        .reduce((sum, e) => {
          const defaultPrezzo = RESIDENZE_CATALOGO.find((r) => r.nome === e.nome)?.costoMensile ?? 0;
          const prezzo = prezzoResidenze[e.nome] ?? defaultPrezzo;
          return sum + prezzo * ((e.abitantiAssegnati ?? []).length);
        }, 0);
      nuovaQuantità = risorsa.quantità + totaleRedditi + entrateResidenze - totaleSpese - totaleStipendiEdifici - costoPensioni;
    }

    nuoviEdifici.forEach((edificio) => {
      if (edificio.stato !== "Operativo") return;
      if (edificio.produzione) {
        const produzioni = edificio.produzione.split(",").map((p) => p.trim());
        produzioni.forEach((prod) => {
          if (prod === risorsa.nome || risorsa.nome.includes(prod) || prod.includes(risorsa.nome)) {
            const numAbitanti = edificio.abitantiAssegnati.length;
            if (numAbitanti > 0) {
              if (risorsa.nome.toLowerCase().includes("cibo")) {
                const produzioneTotale = edificio.abitantiAssegnati.reduce(
                  (sum, id) => sum + getProduzioneCiboPerAbitante(id),
                  0
                );
                totaleCiboProdotto += produzioneTotale;
                nuovaQuantità += produzioneTotale;
              } else {
                const produttivitàMedia =
                  edificio.abitantiAssegnati.reduce((sum, id) => {
                    const abitante = nuoviAbitanti.find((a) => a.id === id);
                    return sum + (abitante?.produttività || 0);
                  }, 0) / numAbitanti;
                nuovaQuantità += Math.floor(numAbitanti * (produttivitàMedia / 10));
              }
            }
          }
        });
      }
      if (edificio.consumo) {
        const consumi = edificio.consumo.split(",").map((c) => c.trim());
        consumi.forEach((cons) => {
          if (cons === risorsa.nome || risorsa.nome.includes(cons) || cons.includes(risorsa.nome)) {
            const consumoBase = edificio.efficienza / 20;
            nuovaQuantità -= Math.floor(consumoBase * (edificio.occupazione / edificio.capacità));
          }
        });
      }
    });

    // Fazione Robots: 2 energia per ogni membro Robot
    if (risorsa.nome === "Energia") {
      const numRobots = nuoviAbitanti.filter((a) => a.razza === "Robot").length;
      nuovaQuantità -= numRobots * 2;
      // Residenze: consumo energia per abitante (es. Baracca 0, Dormitorio 1 MW/abitante)
      nuoviEdifici.forEach((edificio) => {
        if (edificio.stato !== "Operativo" || edificio.tipo !== "Residenza") return;
        const perAbitante = RESIDENZE_ENERGIA_PER_ABITANTE[edificio.nome] ?? 0;
        const numAbitanti = (edificio.abitantiAssegnati ?? []).length;
        nuovaQuantità -= perAbitante * numAbitanti;
      });
    }

    if (risorsa.nome.toLowerCase().includes("cibo") && totaleCiboProdotto > 0) {
      const ministroAgricoltura = nuoviAbitanti.find((a) => a.ministero === "Ministero dell'Agricoltura");
      if (ministroAgricoltura?.personalità === "Pollice Verde") {
        nuovaQuantità += Math.floor(totaleCiboProdotto * 0.1);
      }
    }

    if (risorsa.nome.toLowerCase().includes("cibo")) {
      nuoviAbitanti.forEach((abitante) => {
        nuovaQuantità -= getConsumoCibo(abitante);
      });
    }

    if (risorsa.nome.toLowerCase().includes("acqua")) {
      nuoviAbitanti.forEach((abitante) => {
        if (abitante.razza === "Robot") return;
        nuovaQuantità -= getConsumoAcqua(abitante);
      });
    }

    return { ...risorsa, quantità: Math.max(0, nuovaQuantità) };
  });

  const deltaNativiNonIntegrati = Math.floor(Math.random() * 6);

  const risorseEv = nuoveRisorse.map((r) => ({ ...r }));
  const abitantiEv = nuoviAbitanti.map((a) => ({ ...a }));
  const edificiEv = nuoviEdifici.map((e) => ({
    ...e,
    abitantiAssegnati: (e.abitantiAssegnati ?? []).filter((id) => !idsVittime.has(id))
  }));

  // —— Nascite (gravidanze a 9 mesi) ——
  let newIdNascita: number | null = null;
  let messaggioNascita: string | null = null;
  let idUsato = nextId;
  for (const madre of abitantiEv) {
    if (!madre.incinta || madre.razza === "Robot") continue;
    const startMese = madre.gravidanzaIniziataMese ?? mese;
    const startAnno = madre.gravidanzaIniziataAnno ?? anno;
    const mesiTrascorsi =
      (nuovoAnno - startAnno) * 12 + (nuovoMese - startMese);
    if (mesiTrascorsi < 9) continue;
    const padre = abitantiEv.find((x) => x.id === madre.coniugeId);
    const nomePadre = padre?.nome ?? "?";
    const nomeNeonato = `Figlio di ${madre.nome} e ${nomePadre}`;
    const razzaNeonato = madre.razza ?? padre?.razza ?? "Umano";
    const sessoNeonato = Math.random() < 0.5 ? ("M" as const) : ("F" as const);
    const neonato: Abitante = {
      id: idUsato,
      nome: nomeNeonato,
      emoji: sessoNeonato === "M" ? "🧒" : "👧",
      eta: 0,
      lavoro: "Neonato",
      competenza: 0,
      produttività: 0,
      stanchezza: 0,
      personalità: "Tiepido",
      amici: [],
      rivali: [],
      genitoriIds: [madre.id, ...(padre ? [padre.id] : [])],
      fazioni: [...(madre.fazioni || ["Cittadini"])],
      peso: 35 + Math.floor(Math.random() * 15),
      salute: 70 + Math.floor(Math.random() * 25),
      crediti: 0,
      reddito: 0,
      spese: 0,
      lealtà: 50 + Math.floor(Math.random() * 30),
      paura: 0,
      felicità: 70 + Math.floor(Math.random() * 25),
      religione: madre.religione,
      razza: razzaNeonato,
      sesso: sessoNeonato
    };
    abitantiEv.push(neonato);
    const madreIdx = abitantiEv.findIndex((a) => a.id === madre.id);
    const padreIdx = padre ? abitantiEv.findIndex((a) => a.id === padre.id) : -1;
    if (madreIdx >= 0) {
      const m = abitantiEv[madreIdx];
      abitantiEv[madreIdx] = {
        ...m,
        incinta: false,
        gravidanzaIniziataMese: undefined,
        gravidanzaIniziataAnno: undefined,
        figliIds: [...(m.figliIds ?? []), idUsato]
      };
    }
    if (padreIdx >= 0) {
      const p = abitantiEv[padreIdx];
      abitantiEv[padreIdx] = { ...p, figliIds: [...(p.figliIds ?? []), idUsato] };
    }
    newIdNascita = idUsato;
    messaggioNascita = `È nato/a ${nomeNeonato}. Genitori: ${madre.nome} e ${nomePadre}.`;
    idUsato += 1;
    break; // una nascita per mese
  }

  // —— Concepimento (coppie sposate, politica nascite) ——
  let pendingGravidanza: AvanzaMeseOutput["pendingGravidanza"] = null;
  if (politicaNascite !== "nessuna") {
    const probConcepimento =
      politicaNascite === "incentivi" ? 0.12 : 0.05;
    const coppieGiaElaborate = new Set<string>();
    for (const a of abitantiEv) {
      if (a.coniugeId == null || a.incinta || a.razza === "Robot") continue;
      const b = abitantiEv.find((x) => x.id === a.coniugeId);
      if (!b || b.incinta || b.razza === "Robot") continue;
      const key = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
      if (coppieGiaElaborate.has(key)) continue;
      coppieGiaElaborate.add(key);
      if (politicaNascite === "figlio-unico") {
        if ((a.figliIds?.length ?? 0) > 0) continue;
      }
      if (Math.random() >= probConcepimento) continue;
      const portatrice =
        (a.sesso ?? "M") === "F" ? a : (b.sesso ?? "M") === "F" ? b : Math.random() < 0.5 ? a : b;
      const idx = abitantiEv.findIndex((x) => x.id === portatrice.id);
      if (idx < 0) continue;
      abitantiEv[idx] = {
        ...abitantiEv[idx],
        incinta: true,
        gravidanzaIniziataMese: nuovoMese,
        gravidanzaIniziataAnno: nuovoAnno
      };
      pendingGravidanza = { id: portatrice.id, nome: portatrice.nome };
      break; // un concepimento per mese
    }
  }

  const mesiTrascorsi = (ev: EventoInCorso) =>
    (nuovoAnno - ev.iniziatoAnno) * 12 + (nuovoMese - ev.iniziatoMese);
  let nuoviEventiInCorso = eventiInCorso.filter((ev) => mesiTrascorsi(ev) < ev.durataMesi);
  const avevaAssimilazione = nuoviEventiInCorso.some((e) => e.id === "assimilazione");

  nuoviEventiInCorso.forEach((ev) => {
    const def = EVENTI_CATALOGO.find((d) => d.id === ev.id);
    if (def) def.applicaMensile(risorseEv, abitantiEv, edificiEv);
  });

  let messaggioEmigrazione: string | null = null;
  EVENTI_CATALOGO.forEach((def) => {
    if (nuoviEventiInCorso.some((e) => e.id === def.id)) return;
    if (!def.condizione(abitantiEv, risorseEv, edificiEv, punteggioSanzioni, divietoEspatrioAttivo, calcolaFelicitàModificata, soddisfazioneFazioni)) return;
    if (Math.random() >= def.probabilità) return;
    nuoviEventiInCorso = [
      ...nuoviEventiInCorso,
      { id: def.id, iniziatoMese: nuovoMese, iniziatoAnno: nuovoAnno, durataMesi: def.durataMesi }
    ];
    const ret = def.applicaAttivazione(risorseEv, abitantiEv, edificiEv, { calcolaFelicitàModificata });
    if (def.id === "emigrazione" && ret?.messaggioExtra) messaggioEmigrazione = ret.messaggioExtra;
  });

  const assimilazioneAppenaAggiunto =
    nuoviEventiInCorso.some((e) => e.id === "assimilazione") && !avevaAssimilazione;
  const pendingAssimilazione = assimilazioneAppenaAggiunto ? 1 + Math.floor(Math.random() * 3) : null;

  // Applica ordini mercato (acquisti/vendite)
  let risorseDopoOrdini = risorseEv.map((r) => ({ ...r }));
  const creditiId = 1;
  ordiniMercato.forEach((ordine) => {
    if (ordine.risorsaId === creditiId || ordine.quantità <= 0 || ordine.prezzoUnitario <= 0) return;
    const costo = ordine.quantità * ordine.prezzoUnitario;
    const crediti = risorseDopoOrdini.find((r) => r.id === creditiId);
    const risorsa = risorseDopoOrdini.find((r) => r.id === ordine.risorsaId);
    if (!crediti || !risorsa) return;
    if (ordine.tipo === "compra") {
      if (crediti.quantità < costo) return;
      risorseDopoOrdini = risorseDopoOrdini.map((r) => {
        if (r.id === creditiId) return { ...r, quantità: r.quantità - costo };
        if (r.id === ordine.risorsaId) return { ...r, quantità: r.quantità + ordine.quantità };
        return r;
      });
    } else {
      if (risorsa.quantità < ordine.quantità) return;
      const ricavo = ordine.quantità * ordine.prezzoUnitario;
      risorseDopoOrdini = risorseDopoOrdini.map((r) => {
        if (r.id === creditiId) return { ...r, quantità: r.quantità + ricavo };
        if (r.id === ordine.risorsaId) return { ...r, quantità: r.quantità - ordine.quantità };
        return r;
      });
    }
  });

  // Matrimonio: coppie con amicizia >= 90, non già sposate, compatibili (orientamento/sesso)
  let pendingMatrimonio: AvanzaMeseOutput["pendingMatrimonio"] = null;
  for (const a of abitantiEv) {
    if (a.coniugeId != null) continue;
    for (const rel of a.amici ?? []) {
      if (rel.punteggio < SOGLIA_AMICIZIA_MATRIMONIO) continue;
      const b = abitantiEv.find((x) => x.id === rel.id);
      if (!b || b.coniugeId != null || a.id >= b.id) continue;
      if (!canMarry(a, b) || !canMarry(b, a)) continue;
      pendingMatrimonio = { idA: a.id, idB: b.id, nomeA: a.nome, nomeB: b.nome };
      break;
    }
    if (pendingMatrimonio) break;
  }

  // Avviso Diario: rischio Guerra Civile quando i Lealisti sono vicini alla maggioranza
  let avvisoDiario: string | null = null;
  const guerraCivileInCorso = nuoviEventiInCorso.some((e) => e.id === "guerra-civile");
  if (!guerraCivileInCorso && abitantiEv.length >= 2) {
    const lealisti = abitantiEv.filter((a) => a.fazioni?.includes("Lealisti")).length;
    const maggioranza = Math.floor(abitantiEv.length / 2) + 1;
    const percentuale = Math.round((lealisti / abitantiEv.length) * 100);
    if (lealisti >= maggioranza - 1 || percentuale >= 40) {
      avvisoDiario = `Rischio Guerra Civile: i Lealisti sono ${lealisti}/${abitantiEv.length} (${percentuale}%). Rafforza la Caserma (almeno 3 addetti) e mantieni alta la Soddisfazione della fazione Sicurezza per bloccare o mitigare il conflitto.`;
    }
  }

  return {
    abitanti: abitantiEv,
    edifici: edificiEv,
    risorse: risorseDopoOrdini,
    eventiInCorso: nuoviEventiInCorso,
    nuovoMese,
    nuovoAnno,
    deltaNativiNonIntegrati,
    pendingAssimilazione,
    vittimeOmicidi,
    pendingMatrimonio,
    messaggioEmigrazione,
    pendingGravidanza,
    messaggioNascita,
    newIdNascita,
    avvisoDiario
  };
}
