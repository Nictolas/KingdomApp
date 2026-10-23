/**
 * Scorte astratte finite del Bosco. Ogni valore è fra 0 e 100.
 * Nessun albero o animale viene generato come singolo NPC.
 * Le reazioni religiose derivano dalla dottrina, non dal nome del culto.
 */
export type StagioneBosco = "primavera" | "estate" | "autunno" | "inverno";
export type IntensitaCaccia = "leggera" | "ordinaria" | "spietata";
export type RiserveBosco = { alberi: number; fauna: number; vegetazione: number };

export type UsoBosco = {
  raccoglitori: number;
  cacciatori: number;
  taglialegna: number;
  silvicoltori: number;
  /** 0 significa divieto di caccia. */
  quotaMassimaCacciatori: number;
  intensitaCaccia: IntensitaCaccia;
  stagione: StagioneBosco;
};

const contenuto = (v: number) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));
const persone = (v: number) => Math.max(0, Math.floor(Number.isFinite(v) ? v : 0));

export const RISERVE_BOSCO_INIZIALI: RiserveBosco = {
  alberi: 75, fauna: 70, vegetazione: 80
};

export function aggiornaEcosistemaBosco(
  scorte: RiserveBosco,
  uso: UsoBosco
): { scorte: RiserveBosco; raccolto: { legname: number; selvaggina: number; vegetali: number } } {
  const alberi = contenuto(scorte.alberi);
  const fauna = contenuto(scorte.fauna);
  const vegetazione = contenuto(scorte.vegetazione);
  const periodo = uso.stagione === "inverno" ? 0.2 : uso.stagione === "primavera" ? 1.5 : 1;
  const intensita = uso.intensitaCaccia === "leggera" ? 0.5 : uso.intensitaCaccia === "spietata" ? 2 : 1;
  const cacciatoriEffettivi = Math.min(persone(uso.cacciatori), persone(uso.quotaMassimaCacciatori));
  const richiestaLegname = persone(uso.taglialegna) * 1.3;
  const richiestaSelvaggina = cacciatoriEffettivi * intensita * 1.2;
  const richiestaVegetali = persone(uso.raccoglitori) * 0.75;
  const raccolto = {
    legname: Math.min(alberi, richiestaLegname),
    selvaggina: Math.min(fauna, richiestaSelvaggina),
    vegetali: Math.min(vegetazione, richiestaVegetali)
  };
  const alberiDopo = Math.max(0, alberi - raccolto.legname);
  const faunaDopo = Math.max(0, fauna - raccolto.selvaggina);
  const vegetazioneDopo = Math.max(0, vegetazione - raccolto.vegetali);
  // La foresta impoverita rigenera più lentamente fauna e sottobosco.
  const habitat = alberiDopo / 100;
  const alberiNuovi = periodo * (0.3 + persone(uso.silvicoltori) * 0.6);
  const faunaNuova = periodo * 1.1 * habitat;
  const vegetazioneNuova = periodo * (0.8 + habitat * 0.9);
  return {
    scorte: {
      alberi: contenuto(alberiDopo + alberiNuovi),
      fauna: contenuto(faunaDopo + faunaNuova),
      vegetazione: contenuto(vegetazioneDopo + vegetazioneNuova)
    },
    raccolto
  };
}

export type DottrinaNaturalista = {
  forestaSacra: boolean;
  tutelaFauna: boolean;
  tutelaVegetazione: boolean;
};

/**
 * Modificatore di Soddisfazione basato sullo STATO presente, non una penalità
 * da applicare cumulativamente a ogni tick/giorno.
 */
export function modificatoreSoddisfazioneBosco(
  dottrina: DottrinaNaturalista,
  scorte: RiserveBosco
): number {
  const perdite =
    (dottrina.forestaSacra ? Math.max(0, RISERVE_BOSCO_INIZIALI.alberi - contenuto(scorte.alberi)) * 0.08 : 0) +
    (dottrina.tutelaFauna ? Math.max(0, RISERVE_BOSCO_INIZIALI.fauna - contenuto(scorte.fauna)) * 0.06 : 0) +
    (dottrina.tutelaVegetazione ? Math.max(0, RISERVE_BOSCO_INIZIALI.vegetazione - contenuto(scorte.vegetazione)) * 0.04 : 0);
  return Math.max(-10, Math.min(0, -Math.round(perdite)));
}

/** Resa potenziale del lavoro forestale in rapporto alle scorte disponibili. */
export function probabilitaSuccessoForestale(
  riserva: number, competenza: number, minutiEffettivi: number
): number {
  if (minutiEffettivi <= 0 || riserva <= 0) return 0;
  const tempo = Math.min(1, minutiEffettivi / 360);
  return Math.max(0, Math.min(0.98,
    (0.2 + Math.max(0, Math.min(100, competenza)) * 0.006) *
    (contenuto(riserva) / 100) * tempo
  ));
}

export type StatoEcosistemaBosco = {
  riserve: RiserveBosco;
  ultimoGiornoAggiornato: number;
  quotaMassimaCacciatori: number;
  intensitaCaccia: IntensitaCaccia;
};

export function normalizzaStatoEcosistemaBosco(
  dato: Partial<StatoEcosistemaBosco> | undefined,
  giornoPrimaAttivazione: number
): StatoEcosistemaBosco {
  const r = dato?.riserve;
  return {
    riserve: {
      alberi: contenuto(r?.alberi ?? RISERVE_BOSCO_INIZIALI.alberi),
      fauna: contenuto(r?.fauna ?? RISERVE_BOSCO_INIZIALI.fauna),
      vegetazione: contenuto(r?.vegetazione ?? RISERVE_BOSCO_INIZIALI.vegetazione)
    },
    ultimoGiornoAggiornato: Number.isFinite(dato?.ultimoGiornoAggiornato)
      ? Math.floor(dato!.ultimoGiornoAggiornato!) : giornoPrimaAttivazione,
    quotaMassimaCacciatori: persone(dato?.quotaMassimaCacciatori ?? 10),
    intensitaCaccia: dato?.intensitaCaccia === "leggera" || dato?.intensitaCaccia === "spietata"
      ? dato.intensitaCaccia : "ordinaria"
  };
}

export function aggiornaLeggeCacciaBosco(
  stato: StatoEcosistemaBosco, quota: number, intensita: IntensitaCaccia
): StatoEcosistemaBosco {
  return {
    ...stato,
    quotaMassimaCacciatori: persone(quota),
    intensitaCaccia: intensita
  };
}

export function rigeneraBoscoDopoPrelievi(
  prima: RiserveBosco,
  prelevato: RiserveBosco,
  silvicoltoriAttivi: number,
  stagione: StagioneBosco
): RiserveBosco {
  const residuo = {
    alberi: Math.max(0, contenuto(prima.alberi) - Math.max(0, prelevato.alberi)),
    fauna: Math.max(0, contenuto(prima.fauna) - Math.max(0, prelevato.fauna)),
    vegetazione: Math.max(0, contenuto(prima.vegetazione) - Math.max(0, prelevato.vegetazione))
  };
  const t = stagione === "inverno" ? 0.2 : stagione === "primavera" ? 1.5 : 1;
  const habitat = residuo.alberi / 100;
  return {
    alberi: contenuto(residuo.alberi + t * (0.3 + persone(silvicoltoriAttivi) * 0.6)),
    fauna: contenuto(residuo.fauna + t * 1.1 * habitat),
    vegetazione: contenuto(residuo.vegetazione + t * (0.8 + habitat * 0.9))
  };
}
