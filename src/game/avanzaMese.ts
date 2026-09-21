import type { Abitante, Risorsa, Edificio, OrdineMercato, EventoInCorso } from "../types";
import { EVENTI_CATALOGO } from "./eventi/index";
import { getConsumoCibo, getConsumoAcqua, getProduzioneCiboPerAbitante } from "./ciboConsumo";
import {
  abitanteConInventarioIniziale,
  getMoneteInventarioAbitante,
  setMoneteInventarioAbitante
} from "./inventario";
import { RESIDENZE_CATALOGO } from "../data/residenzeData";
import { getCastaAbitante, isCastaCoercibile } from "./casta";
import { autoAssegnaCittadiniDisoccupati, autoAssegnaDisoccupati, isEdificioPubblicoConPostazioniLavoro, normalizzaLavoroEAgricoltura } from "./edificiLavoro";
import { avanzaCostruzioniEdifici } from "./costruzioneEdifici";
import { applicaRedditoSchiaviAlPadroni, isOmicidioSchiavoImmune, LAVORO_GIOCATORE } from "./schiavituCommercio";
import { specializzazioneCasuale } from "./specializzazione";
import { getProduttivitaEffettiva, normalizzaAbitanteBisogni } from "./bisogni";
import { getStipendioMensileEdificio } from "./edificiPubblici";
import { redditoMensileLavoroDefault } from "./economiaPrezzi";
import { generaAspettoCasuale } from "./personaggioAspetto";
import { applicaLuttoFamiliareERimuoviMorti } from "./soddisfazione";
import { applicaMoltiplicatoreProduzione } from "./reModalita";
import { estraiCreditiLegacyDaRisorse } from "../data/risorseData";

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
  /** Assegno mensile in monete dato a ogni pensionato. */
  assegnoPensionati: number;
  /** Soddisfazione 1-100 per fazioni tracciate (es. Rivoluzionari). */
  soddisfazioneFazioni?: Record<string, number>;
  /** Prezzo mensile (monete) per tipo di residenza. Se assente si usa il default del catalogo. */
  prezzoResidenze?: Record<string, number>;
  /** Importo mensile del Reddito di Cittadinanza (monete) per ogni disoccupato non schiavo. */
  redditoCittadinanza?: number;
  /** Modalità del sistema sanitario (Privata/Pubblica) per i costi dell'Ospedale. */
  modalitaSanita?: "privata" | "pubblica";
  /** Configurazione legge famiglie (matrimonio umano-Golem, intercasta, …). */
  tipologieFamigliaAccettate?: {
    matrimonioConGolem: boolean;
    matrimonioIntercasta?: boolean;
  };
  /** Tesoro del regno (unica cassa monete). */
  moneteGiocatore: number;
  /** Edificio visitato dal Re: solo la sua produzione riceve il +15%. */
  edificioBuffVisitaId?: number | null;
};

export type AvanzaMeseOutput = {
  abitanti: Abitante[];
  edifici: Edificio[];
  risorse: Risorsa[];
  /** Tesoro dopo affitti, pensioni/cittadinanza, eventi, mercato. */
  moneteGiocatore: number;
  eventiInCorso: EventoInCorso[];
  nuovoMese: number;
  nuovoAnno: number;
  deltaNativiNonIntegrati: number;
  pendingAssimilazione: number | null;
  /** Vittime di omicidio per rivalità (per mostrare alert). */
  vittimeOmicidi: { nome: string }[];
  /** Coppia con amicizia >= 90 che chiede di sposarsi (compatibili per orientamento/sesso). */
  pendingMatrimonio: { idA: number; idB: number; nomeA: string; nomeB: string } | null;
  /** Messaggio da mostrare in home quando si attiva l'evento Emigrazione (es. "Alessandro Ricci ha lasciato il regno."). */
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

/** Sincronizza le residenze: Baracca = tutti e solo i Senzatetto; le altre residenze non ospitano Senzatetto. */
export function syncResidenzeBaraccaSenzatetto(edifici: Edificio[], abitanti: Abitante[]): Edificio[] {
  const senzatettoIds = new Set(abitanti.filter((a) => a.fazioni?.includes("Senzatetto")).map((a) => a.id));
  const baraccaIdsOrdinati = edifici
    .filter((x) => x.nome === "Baracca")
    .map((x) => x.id)
    .sort((a, b) => a - b);
  const baraccaPrimariaId = baraccaIdsOrdinati[0];
  return edifici.map((e) => {
    if (e.tipo !== "Residenza") return e;
    if (e.nome === "Baracca") {
      const ids = e.id === baraccaPrimariaId ? [...senzatettoIds] : [];
      return { ...e, abitantiAssegnati: ids, occupazione: ids.length };
    }
    const nuovi = (e.abitantiAssegnati ?? []).filter((id) => !senzatettoIds.has(id));
    return { ...e, abitantiAssegnati: nuovi, occupazione: nuovi.length };
  });
}

/** Compatibilità matrimonio: Omo solo con Omo/Bi stesso sesso; Etero con Etero/Bi sesso opposto; Bi con chiunque; Asessuale con nessuno. */
export function canMarry(a: Abitante, b: Abitante): boolean {
  const sessoA = a.sesso ?? "M";
  const sessoB = b.sesso ?? "M";
  const orA = a.orientamento ?? "Etero";
  const orB = b.orientamento ?? "Etero";
  if (orA === "Asessuale" || orB === "Asessuale") return false;
  const stessoSesso = sessoA === sessoB;
  if (orA === "Omo") return (orB === "Omo" || orB === "Bi") && stessoSesso;
  if (orA === "Etero") return (orB === "Etero" || orB === "Bi") && !stessoSesso;
  if (orA === "Bi") return true; // Bi con chiunque
  return false;
}

const SOGLIA_AMICIZIA_MATRIMONIO = 90;

/** True se la coppia (a,b) è consentita dalla legge (Golem, casta diversa, …). */
function coppiaConsentitaLegge(
  a: Abitante,
  b: Abitante,
  tipologie?: { matrimonioConGolem: boolean; matrimonioIntercasta?: boolean }
): boolean {
  const unoGolem = (a.razza ?? "Umano") === "Golem";
  const altroGolem = (b.razza ?? "Umano") === "Golem";
  if (unoGolem !== altroGolem) {
    return tipologie?.matrimonioConGolem === true;
  }
  const castaA = getCastaAbitante(a);
  const castaB = getCastaAbitante(b);
  if (castaA !== castaB) {
    return tipologie?.matrimonioIntercasta === true;
  }
  return true;
}

/** True se esiste almeno una coppia (non sposata, amicizia ≥90, compatibile) che può generare pendingMatrimonio al cambio mese automatico. */
export function esisteCoppiaMatrimonioPossibile(
  abitanti: Abitante[],
  tipologieFamigliaAccettate?: { matrimonioConGolem: boolean; matrimonioIntercasta?: boolean }
): boolean {
  for (const a of abitanti) {
    if (a.coniugeId != null) continue;
    for (const rel of a.amici ?? []) {
      if (rel.punteggio < SOGLIA_AMICIZIA_MATRIMONIO) continue;
      const b = abitanti.find((x) => x.id === rel.id);
      if (!b || b.coniugeId != null || a.id >= b.id) continue;
      if (!canMarry(a, b) || !canMarry(b, a)) continue;
      if (!coppiaConsentitaLegge(a, b, tipologieFamigliaAccettate)) continue;
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
    modalitaSanita = "privata",
    moneteGiocatore: moneteGiocatoreIn,
    edificioBuffVisitaId = null
  } = input;

  let moneteGiocatore = Math.max(0, Math.floor(moneteGiocatoreIn));
  // Normalizza risorse legacy prima del calcolo mensile.
  const risorseSenzaCrediti = estraiCreditiLegacyDaRisorse(risorse).risorse;

  // Baracca contiene tutti e solo i Senzatetto; sincronizza prima di procedere.
  let edificiSync = syncResidenzeBaraccaSenzatetto(edifici, abitanti);

  const nuovoMese = mese === 12 ? 1 : mese + 1;
  const nuovoAnno = mese === 12 ? anno + 1 : anno;
  const avanzaAnno = nuovoAnno > anno;

  let abitantiRimasti = abitanti;

  // Omicidi per rivalità: coppie con punteggio rivalità >= 90 (o >= 60 se uno è Psicopatico), 50% probabilità che uno uccida l'altro
  const SOGLIA_RIVALITÀ = 90;
  const SOGLIA_PSICOPATICO = 60;
  const vittimeOmicidi: { nome: string }[] = [];
  const idsVittime = new Set<number>();
  const reatiOmicidioPerKiller = new Map<number, number>();
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
      const uccisore = vittima.id === A.id ? B : A;
      vittimeOmicidi.push({ nome: vittima.nome });
      idsVittime.add(vittima.id);
      if (!isOmicidioSchiavoImmune(uccisore, vittima)) {
        reatiOmicidioPerKiller.set(uccisore.id, (reatiOmicidioPerKiller.get(uccisore.id) ?? 0) + 1);
      }
    }
  }
  const abitantiConReatiOmicidio = abitantiRimasti.map((a) => {
    const n = reatiOmicidioPerKiller.get(a.id);
    if (!n) return a;
    const reati = [...(a.reati ?? [])];
    for (let i = 0; i < n; i++) reati.push("Omicidio");
    return { ...a, reati };
  });
  abitantiRimasti = applicaLuttoFamiliareERimuoviMorti(abitantiConReatiOmicidio, idsVittime);

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
  edificiSync.forEach((edificio) => {
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

  // Invecchiamento: +1 anno quando si cambia anno. Calcola chi diventa pensionato per rimuoverli dagli edifici.
  const idsPensionati = new Set<number>();
  abitantiRimasti.forEach((a) => {
    const etaNext = avanzaAnno ? a.eta + 1 : a.eta;
    if (
      etaNext >= etaPensionabile &&
      a.lavoro !== LAVORO_GIOCATORE &&
      a.lavoro !== "Neonato" &&
      a.lavoro !== "Pensionato"
    ) {
      idsPensionati.add(a.id);
    }
  });

  // Aggiorna edifici (rimuovi pensionati, variazione efficienza)
  const nuoviEdifici = edificiSync.map((edificio) => {
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

  // Auto-assign: Disoccupati (non Golem) con competenza sufficiente vanno in edifici con posti liberi;
  // poi Agricoltori nelle Serre e lavoro allineato alle assegnazioni.
  let edificiConAuto = autoAssegnaDisoccupati(abitantiRimasti, nuoviEdifici);
  edificiConAuto = autoAssegnaCittadiniDisoccupati(abitantiRimasti, edificiConAuto);
  const normLavoro = normalizzaLavoroEAgricoltura(abitantiRimasti, edificiConAuto);
  edificiConAuto = normLavoro.edifici;
  const abitantiConLavoro = normLavoro.abitanti;

  const avanzamentoCantieri = avanzaCostruzioniEdifici(edificiConAuto, abitantiConLavoro);
  edificiConAuto = avanzamentoCantieri.edifici;

  const idLavoratoreEdificioPubblico = new Set<number>();
  const idToEdificioPubblico = new Map<number, Edificio>();
  edificiConAuto.forEach((e) => {
    if (!isEdificioPubblicoConPostazioniLavoro(e)) return;
    (e.abitantiAssegnati ?? []).forEach((id) => {
      idLavoratoreEdificioPubblico.add(id);
      idToEdificioPubblico.set(id, e);
    });
  });

  // Costo abitazione per abitante (dalla residenza assegnata). Usato per Senzatetto e per entrateResidenze.
  const idToCostoAbitazione = new Map<number, number>();
  edificiConAuto.forEach((edificio) => {
    if (edificio.tipo !== "Residenza" || edificio.stato !== "Operativo") return;
    const prezzo =
      edificio.nome === "Baracca"
        ? 0
        : (prezzoResidenze[edificio.nome] ?? RESIDENZE_CATALOGO.find((r) => r.nome === edificio.nome)?.costoMensile ?? 0);
    (edificio.abitantiAssegnati ?? []).forEach((id) => idToCostoAbitazione.set(id, prezzo));
  });

  /** Affitti pagati questo mese → accreditati alla risorsa Crediti del regno (non al tesoro moneteGiocatore). */
  let totaleAffittiPagati = 0;

  // Aggiorna abitanti (invecchiamento, pensionamento, monete inventario, stanchezza/bisogni, peso, salute)
  const nuoviAbitanti = abitantiConLavoro.map((abitante) => {
    let eta = abitante.eta;
    if (avanzaAnno) eta += 1;

    let lavoro = abitante.lavoro;
    if (
      eta >= etaPensionabile &&
      lavoro !== LAVORO_GIOCATORE &&
      lavoro !== "Neonato" &&
      lavoro !== "Pensionato"
    ) {
      lavoro = "Pensionato";
    }

    const èCoercibile = isCastaCoercibile(getCastaAbitante(abitante));
    const pubblico = idLavoratoreEdificioPubblico.has(abitante.id);

    // Reddito = display / bilanci; spese fisse = 0 (costi reali: affitto + bar/negozio).
    let reddito = 0;
    const spese = 0;
    if (lavoro === "Pensionato") {
      reddito = assegnoPensionati;
    } else if (lavoro === "Disoccupato") {
      reddito = !èCoercibile && redditoCittadinanza > 0 ? redditoCittadinanza : 0;
    } else if (pubblico) {
      const ed = idToEdificioPubblico.get(abitante.id);
      reddito = ed ? getStipendioMensileEdificio(ed) : redditoMensileLavoroDefault();
    } else if (lavoro === LAVORO_GIOCATORE) {
      reddito = redditoMensileLavoroDefault() * 2;
    } else {
      reddito = redditoMensileLavoroDefault();
    }

    if (èCoercibile) {
      const base = normalizzaAbitanteBisogni({
        ...abitante,
        eta,
        lavoro,
        reddito: 0,
        crediti: 0,
        spese: 0
      });
      const variazionePeso = Math.floor(Math.random() * 6) - 2;
      const nuovoPeso = Math.max(0, Math.min(100, base.peso + variazionePeso));
      const variazioneSalute = Math.floor(Math.random() * 6) - 2;
      const nuovaSalute = Math.max(0, Math.min(100, base.salute + variazioneSalute));
      return {
        ...base,
        peso: nuovoPeso,
        salute: nuovaSalute
      };
    }

    const moneteAttuali = getMoneteInventarioAbitante(abitante.inventario);
    const costoAbitazione = idToCostoAbitazione.get(abitante.id) ?? 0;
    const puòPermettersiAbitazione = moneteAttuali >= costoAbitazione;
    const spesaAbitazioneEffettiva = costoAbitazione > 0 && puòPermettersiAbitazione ? costoAbitazione : 0;
    if (spesaAbitazioneEffettiva > 0) totaleAffittiPagati += spesaAbitazioneEffettiva;

    let fazioni = abitante.fazioni ?? [];
    if (costoAbitazione > 0 && !puòPermettersiAbitazione) {
      fazioni = [...fazioni.filter((f) => f !== "Senzatetto"), "Senzatetto"];
    } else {
      fazioni = fazioni.filter((f) => f !== "Senzatetto");
    }

    // Monete: affitto reale; stipendio mensile solo se non già pagato dagli edifici pubblici (giornaliero).
    let nuovoSaldo = moneteAttuali - spesaAbitazioneEffettiva;
    if (!pubblico && reddito > 0) {
      nuovoSaldo += reddito;
    }

    const variazionePeso = Math.floor(Math.random() * 6) - 2;
    const nuovoPeso = Math.max(0, Math.min(100, abitante.peso + variazionePeso));
    const variazioneSalute = Math.floor(Math.random() * 6) - 2;
    const nuovaSalute = Math.max(0, Math.min(100, abitante.salute + variazioneSalute));
    const aggiornato = normalizzaAbitanteBisogni({
      ...abitante,
      eta,
      lavoro,
      reddito,
      spese,
      crediti: 0,
      fazioni,
      peso: nuovoPeso,
      salute: nuovaSalute
    });
    return setMoneteInventarioAbitante(aggiornato, Math.max(0, nuovoSaldo));
  });

  const { abitanti: abitantiConRedditoPadroni } = applicaRedditoSchiaviAlPadroni(nuoviAbitanti);

  // Tesoro: +affitti; −assegni pensioni e reddito cittadinanza già accreditati agli inventari.
  moneteGiocatore += totaleAffittiPagati;
  const numPensionati = abitantiConRedditoPadroni.filter((a) => a.lavoro === "Pensionato").length;
  moneteGiocatore -= numPensionati * assegnoPensionati;
  const beneficiariCittadinanza = abitantiConRedditoPadroni.filter(
    (a) =>
      a.razza !== "Golem" &&
      a.lavoro === "Disoccupato" &&
      !isCastaCoercibile(getCastaAbitante(a)) &&
      redditoCittadinanza > 0
  ).length;
  moneteGiocatore -= beneficiariCittadinanza * redditoCittadinanza;
  moneteGiocatore = Math.max(0, moneteGiocatore);

  // Aggiorna risorse materiali (produzione/consumo edifici, cibo, ecc.)
  const nuoveRisorse = risorseSenzaCrediti.map((risorsa) => {
    let nuovaQuantità = risorsa.quantità;
    let totaleCiboProdotto = 0;

    edificiConAuto.forEach((edificio) => {
      if (edificio.stato !== "Operativo") return;
      if (edificio.produzione) {
        const produzioni = edificio.produzione.split(",").map((p) => p.trim());
        produzioni.forEach((prod) => {
          if (prod === risorsa.nome || risorsa.nome.includes(prod) || prod.includes(risorsa.nome)) {
            const numAbitanti = edificio.abitantiAssegnati.length;
            if (numAbitanti > 0) {
              if (risorsa.nome.toLowerCase().includes("cibo")) {
                // Il cibo vegetale della Serra va nell'inventario (produzione giornaliera / cambio mese automatico).
                if (edificio.nome === "Serra") return;
                const produzioneBase = edificio.abitantiAssegnati.reduce(
                  (sum, id) => sum + getProduzioneCiboPerAbitante(id),
                  0
                );
                const produzioneTotale = applicaMoltiplicatoreProduzione(
                  produzioneBase,
                  edificio.id === edificioBuffVisitaId
                );
                totaleCiboProdotto += produzioneTotale;
                nuovaQuantità += produzioneTotale;
              } else {
                const produttivitàMedia =
                  edificio.abitantiAssegnati.reduce((sum, id) => {
                    const abitante = abitantiConRedditoPadroni.find((a) => a.id === id);
                    return sum + (abitante ? getProduttivitaEffettiva(abitante) : 0);
                  }, 0) / numAbitanti;
                const produzioneBase = Math.floor(numAbitanti * (produttivitàMedia / 10));
                nuovaQuantità += applicaMoltiplicatoreProduzione(
                  produzioneBase,
                  edificio.id === edificioBuffVisitaId
                );
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

    // I Golem sono animati dall'Energia Magica: 2 mana per Golem al mese.
    if (risorsa.nome === "Energia Magica") {
      const numGolem = abitantiConRedditoPadroni.filter((a) => a.razza === "Golem").length;
      nuovaQuantità -= numGolem * 2;
    }

    if (risorsa.nome.toLowerCase().includes("cibo") && totaleCiboProdotto > 0) {
      const ministroAgricoltura = abitantiConRedditoPadroni.find((a) => a.ministero === "Ministero dell'Agricoltura");
      if (ministroAgricoltura?.personalità === "Pollice Verde") {
        nuovaQuantità += Math.floor(totaleCiboProdotto * 0.1);
      }
    }

    if (risorsa.nome.toLowerCase().includes("cibo")) {
      abitantiConRedditoPadroni.forEach((abitante) => {
        nuovaQuantità -= getConsumoCibo(abitante);
      });
    }

    if (risorsa.nome.toLowerCase().includes("acqua")) {
      abitantiConRedditoPadroni.forEach((abitante) => {
        if (abitante.razza === "Golem") return;
        nuovaQuantità -= getConsumoAcqua(abitante);
      });
    }

    return { ...risorsa, quantità: Math.max(0, nuovaQuantità) };
  });

  const deltaNativiNonIntegrati = Math.floor(Math.random() * 6);

  const risorseEv = nuoveRisorse.map((r) => ({ ...r }));
  const abitantiEv = abitantiConRedditoPadroni.map((a) => ({ ...a }));
  const edificiEv = edificiConAuto.map((e) => ({
    ...e,
    abitantiAssegnati: (e.abitantiAssegnati ?? []).filter((id) => !idsVittime.has(id))
  }));

  // —— Nascite (gravidanze a 9 mesi) ——
  let newIdNascita: number | null = null;
  let messaggioNascita: string | null = null;
  let idUsato = nextId;
  for (const madre of abitantiEv) {
    if (!madre.incinta || madre.razza === "Golem") continue;
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
      ...(razzaNeonato !== "Golem" && { aspetto: generaAspettoCasuale(razzaNeonato) }),
      sesso: sessoNeonato,
      specializzazione: specializzazioneCasuale(),
      bisogni: { fame: 80, energia: 90, divertimento: 70, socialita: 70, igiene: 80 }
    };
    abitantiEv.push(abitanteConInventarioIniziale(neonato));
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
      if (a.coniugeId == null || a.incinta || a.razza === "Golem") continue;
      const b = abitantiEv.find((x) => x.id === a.coniugeId);
      if (!b || b.incinta || b.razza === "Golem") continue;
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
    if (
      !def.condizione(
        abitantiEv,
        risorseEv,
        edificiEv,
        punteggioSanzioni,
        divietoEspatrioAttivo,
        calcolaFelicitàModificata,
        soddisfazioneFazioni
      )
    )
      return;
    if (Math.random() >= def.probabilità) return;
    nuoviEventiInCorso = [
      ...nuoviEventiInCorso,
      { id: def.id, iniziatoMese: nuovoMese, iniziatoAnno: nuovoAnno, durataMesi: def.durataMesi }
    ];
    const tesoroBag = { monete: moneteGiocatore };
    const ret = def.applicaAttivazione(risorseEv, abitantiEv, edificiEv, {
      calcolaFelicitàModificata,
      tesoro: tesoroBag
    });
    moneteGiocatore = tesoroBag.monete;
    if (def.id === "emigrazione" && ret?.messaggioExtra) messaggioEmigrazione = ret.messaggioExtra;
  });

  const assimilazioneAppenaAggiunto =
    nuoviEventiInCorso.some((e) => e.id === "assimilazione") && !avevaAssimilazione;
  const pendingAssimilazione = assimilazioneAppenaAggiunto ? 1 + Math.floor(Math.random() * 3) : null;

  // Applica ordini mercato (acquisti/vendite) — pagati dal Tesoro
  let risorseDopoOrdini = risorseEv.map((r) => ({ ...r })).filter((r) => r.nome !== "Crediti");
  ordiniMercato.forEach((ordine) => {
    if (ordine.quantità <= 0 || ordine.prezzoUnitario <= 0) return;
    const costo = ordine.quantità * ordine.prezzoUnitario;
    const risorsa = risorseDopoOrdini.find((r) => r.id === ordine.risorsaId);
    if (!risorsa) return;
    if (ordine.tipo === "compra") {
      if (moneteGiocatore < costo) return;
      moneteGiocatore -= costo;
      risorseDopoOrdini = risorseDopoOrdini.map((r) =>
        r.id === ordine.risorsaId ? { ...r, quantità: r.quantità + ordine.quantità } : r
      );
    } else {
      if (risorsa.quantità < ordine.quantità) return;
      moneteGiocatore += costo;
      risorseDopoOrdini = risorseDopoOrdini.map((r) =>
        r.id === ordine.risorsaId ? { ...r, quantità: r.quantità - ordine.quantità } : r
      );
    }
  });
  moneteGiocatore = Math.max(0, moneteGiocatore);

  // Matrimonio: coppie con amicizia >= 90, non già sposate, compatibili (orientamento/sesso) e consentite dalla legge (es. umano-Golem)
  const tipologie = input.tipologieFamigliaAccettate;
  let pendingMatrimonio: AvanzaMeseOutput["pendingMatrimonio"] = null;
  for (const a of abitantiEv) {
    if (a.coniugeId != null) continue;
    for (const rel of a.amici ?? []) {
      if (rel.punteggio < SOGLIA_AMICIZIA_MATRIMONIO) continue;
      const b = abitantiEv.find((x) => x.id === rel.id);
      if (!b || b.coniugeId != null || a.id >= b.id) continue;
      if (!canMarry(a, b) || !canMarry(b, a)) continue;
      if (!coppiaConsentitaLegge(a, b, tipologie)) continue;
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
  if (avanzamentoCantieri.completati.length > 0) {
    const msgCantieri = avanzamentoCantieri.completati
      .map((c) => `${c.nome} è stato completato.`)
      .join(" ");
    avvisoDiario = avvisoDiario ? `${avvisoDiario}\n${msgCantieri}` : msgCantieri;
  }

  // Sincronizza di nuovo Baracca con i Senzatetto (dopo aggiornamento fazioni in nuoviAbitanti)
  const edificiEvSync = syncResidenzeBaraccaSenzatetto(edificiEv, abitantiEv);

  return {
    abitanti: abitantiEv,
    edifici: edificiEvSync,
    risorse: risorseDopoOrdini,
    moneteGiocatore,
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
