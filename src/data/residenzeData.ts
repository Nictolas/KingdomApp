/**
 * Catalogo tipi di residenza.
 * energiaPerAbitante: consumo mensile di energia (MW) per ogni residente.
 * costoMensile: affitto in monete (scala stipendio ~1/giorno) — vedi economiaPrezzi.
 */

import { AFFITTO_MENSILE_PER_RESIDENZA } from "../game/economiaPrezzi";

export type ResidenzaTipo = {
  id: string;
  nome: string;
  /** Nome al plurale per la UI (es. Baracche, Dormitori). */
  nomePlurale: string;
  emoji: string;
  felicità: number;
  costoMensile: number;
  /** Consumo energia (MW) per abitante al mese. Es: Baracca 0, Dormitorio 1. */
  energiaPerAbitante: number;
  /** Posti per unità; ignorato se postiIllimitati è true. */
  abitanti: number;
  /** Se true, la residenza ha capacità illimitata per unità (es. Baracca). */
  postiIllimitati?: boolean;
  /** Se impostato, solo abitanti di questa fazione possono vivere qui. */
  fazioneRichiesta?: string;
};

export const RESIDENZE_CATALOGO: ResidenzaTipo[] = [
  { id: "baracca", nome: "Baracca", nomePlurale: "Baracche", emoji: "📦", felicità: 5, costoMensile: AFFITTO_MENSILE_PER_RESIDENZA.Baracca ?? 0, energiaPerAbitante: 0, abitanti: 0, postiIllimitati: true },
  { id: "capanna", nome: "Capanna", nomePlurale: "Capanne", emoji: "🏠", felicità: 8, costoMensile: AFFITTO_MENSILE_PER_RESIDENZA.Capanna ?? 0, energiaPerAbitante: 0, abitanti: 30 },
  { id: "dormitorio", nome: "Dormitorio", nomePlurale: "Dormitori", emoji: "🛏️", felicità: 10, costoMensile: AFFITTO_MENSILE_PER_RESIDENZA.Dormitorio ?? 10, energiaPerAbitante: 1, abitanti: 10 },
  { id: "modulo", nome: "Modulo", nomePlurale: "Moduli", emoji: "📦", felicità: 30, costoMensile: AFFITTO_MENSILE_PER_RESIDENZA.Modulo ?? 22, energiaPerAbitante: 3, abitanti: 4 },
  { id: "villetta", nome: "Villetta", nomePlurale: "Villette", emoji: "🏡", felicità: 45, costoMensile: AFFITTO_MENSILE_PER_RESIDENZA.Villetta ?? 40, energiaPerAbitante: 5, abitanti: 5 },
  { id: "attico", nome: "Attico", nomePlurale: "Attici", emoji: "🏢", felicità: 80, costoMensile: AFFITTO_MENSILE_PER_RESIDENZA.Attico ?? 80, energiaPerAbitante: 20, abitanti: 3 },
  { id: "villa", nome: "Villa", nomePlurale: "Ville", emoji: "🏰", felicità: 120, costoMensile: AFFITTO_MENSILE_PER_RESIDENZA.Villa ?? 150, energiaPerAbitante: 17, abitanti: 6 }
];

/** Mappa nome edificio residenza → energia (MW) per abitante al mese. */
export const RESIDENZE_ENERGIA_PER_ABITANTE: Record<string, number> = Object.fromEntries(
  RESIDENZE_CATALOGO.map((r) => [r.nome, r.energiaPerAbitante])
);
