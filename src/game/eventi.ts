import type { Abitante, Risorsa, Edificio } from "../types";

export type EventoDef = {
  id: string;
  nome: string;
  emoji: string;
  descrizione: string;
  durataMesi: number;
  /** Probabilità 0-1 di attivazione quando la condizione è vera */
  probabilità: number;
  condizione: (abitanti: Abitante[], risorse: Risorsa[], edifici: Edificio[], punteggioSanzioni: number, divietoEspatrioAttivo?: boolean) => boolean;
  /** Effetto all'attivazione (modifica risorse/abitanti/edifici in place). Può restituire messaggio extra per il dialog. */
  applicaAttivazione: (
    risorse: Risorsa[],
    abitanti: Abitante[],
    edifici: Edificio[]
  ) => void | { messaggioExtra?: string };
  /** Effetto ogni mese mentre l'evento è in corso */
  applicaMensile: (risorse: Risorsa[], abitanti: Abitante[], edifici: Edificio[]) => void;
};

const modificaRisorsa = (risorse: Risorsa[], nome: string, delta: number) => {
  const r = risorse.find((x) => x.nome === nome || x.nome.toLowerCase().includes(nome.toLowerCase()));
  if (r) r.quantità = Math.max(0, r.quantità + delta);
};

export const EVENTI_CATALOGO: EventoDef[] = [
  {
    id: "proteste-autoctoni",
    nome: "Proteste degli Autoctoni",
    emoji: "✊",
    descrizione: "La popolazione nativa del pianeta manifesta contro l'espansione della colonia. Rischio di tensione sociale e calo di felicità.",
    durataMesi: 2,
    probabilità: 0.25,
    condizione: (abitanti, _r, _e, _p) => {
      if (abitanti.length === 0) return false;
      const felicitàMedia = abitanti.reduce((s, a) => s + a.felicità, 0) / abitanti.length;
      return felicitàMedia < 45;
    },
    applicaAttivazione: () => {},
    applicaMensile: (_r, abitanti) => {
      abitanti.forEach((a) => {
        (a as Abitante).felicità = Math.max(1, (a as Abitante).felicità - 3);
      });
    }
  },
  {
    id: "attentato",
    nome: "Attentato",
    emoji: "💥",
    descrizione: "Un attacco terroristico o sabotaggio colpisce infrastrutture o abitanti.",
    durataMesi: 1,
    probabilità: 0.2,
    condizione: (abitanti) => abitanti.filter((a) => (a.reati?.length ?? 0) > 0).length >= 1,
    applicaAttivazione: (_r, abitanti) => {
      const vittime = abitanti.filter((a) => a.peso > 20);
      if (vittime.length > 0) {
        const v = vittime[Math.floor(Math.random() * vittime.length)];
        (v as Abitante).peso = Math.max(0, (v as Abitante).peso - 25);
      }
    },
    applicaMensile: () => {}
  },
  {
    id: "carestia",
    nome: "Carestia",
    emoji: "🌾",
    descrizione: "Raccolti falliti o scorte di cibo insufficienti. La colonia deve gestire la distribuzione.",
    durataMesi: 2,
    probabilità: 0.3,
    condizione: (_a, risorse) => {
      const cibo = risorse.find((r) => r.nome.toLowerCase().includes("cibo"));
      return (cibo?.quantità ?? 0) < 150;
    },
    applicaAttivazione: (risorse) => modificaRisorsa(risorse, "Cibo", -50),
    applicaMensile: (risorse, abitanti) => {
      modificaRisorsa(risorse, "Cibo", -30);
      abitanti.forEach((a) => {
        (a as Abitante).peso = Math.max(0, (a as Abitante).peso - 3);
      });
    }
  },
  {
    id: "pandemia",
    nome: "Pandemia",
    emoji: "🦠",
    descrizione: "Un'epidemia si diffonde tra i coloni. L'ospedale e le medicine sono cruciali.",
    durataMesi: 3,
    probabilità: 0.15,
    condizione: (_a, risorse) => {
      const medicine = risorse.find((r) => r.nome === "Medicine");
      return (medicine?.quantità ?? 0) < 80;
    },
    applicaAttivazione: (risorse) => modificaRisorsa(risorse, "Medicine", -15),
    applicaMensile: (risorse, abitanti) => {
      modificaRisorsa(risorse, "Medicine", -15);
      abitanti.forEach((a) => {
        (a as Abitante).peso = Math.max(0, (a as Abitante).peso - 10);
      });
    }
  },
  {
    id: "tempesta-solare",
    nome: "Tempesta Solare",
    emoji: "☀️",
    descrizione: "Una tempesta solare danneggia i sistemi e la produzione di energia.",
    durataMesi: 1,
    probabilità: 0.05,
    condizione: () => true,
    applicaAttivazione: (risorse) => modificaRisorsa(risorse, "Energia", -30),
    applicaMensile: () => {}
  },
  {
    id: "minacce-geopolitiche",
    nome: "Minacce geopolitiche",
    emoji: "🌐",
    descrizione: "Tensioni con altre colonie o entità politiche. Possibili sanzioni.",
    durataMesi: 1,
    probabilità: 0.25,
    condizione: (_a, _r, _e, punteggioSanzioni) => punteggioSanzioni >= 6,
    applicaAttivazione: (risorse) => modificaRisorsa(risorse, "Crediti", -150),
    applicaMensile: () => {}
  },
  {
    id: "assimilazione",
    nome: "Assimilazione",
    emoji: "🤝",
    descrizione: "Alcuni nativi (da 0 a 3) vogliono aggiungersi alla colonia. Vuoi accettarli? (Si verifica solo se la Felicità Media degli abitanti è superiore all'80%.)",
    durataMesi: 1,
    probabilità: 0.4,
    condizione: (abitanti) => {
      if (abitanti.length === 0) return false;
      const felicitàMedia = abitanti.reduce((s, a) => s + a.felicità, 0) / abitanti.length;
      return felicitàMedia > 80;
    },
    applicaAttivazione: () => {},
    applicaMensile: () => {}
  },
  {
    id: "emigrazione",
    nome: "Emigrazione",
    emoji: "✈️",
    descrizione: "Un abitante con Felicità pari o inferiore al 50% lascia la colonia per cercare fortuna altrove.",
    durataMesi: 1,
    probabilità: 0.5,
    condizione: (abitanti, _r, _e, _p, divietoEspatrioAttivo) => {
      if (divietoEspatrioAttivo) return false;
      return abitanti.some((a) => a.id !== 1 && a.felicità <= 50);
    },
    applicaAttivazione: (_risorse, abitanti, edifici) => {
      const candidati = abitanti.filter((a) => a.id !== 1 && a.felicità <= 50);
      if (candidati.length === 0) return;
      const scelto = candidati[Math.floor(Math.random() * candidati.length)];
      const nome = scelto.nome;
      const idx = abitanti.findIndex((a) => a.id === scelto.id);
      if (idx >= 0) abitanti.splice(idx, 1);
      edifici.forEach((e) => {
        if (e.abitantiAssegnati) {
          e.abitantiAssegnati = e.abitantiAssegnati.filter((id) => id !== scelto.id);
        }
      });
      return { messaggioExtra: `${nome} ha lasciato la colonia.` };
    },
    applicaMensile: () => {}
  }
];
