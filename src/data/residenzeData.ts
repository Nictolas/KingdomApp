/**
 * Catalogo tipi di residenza.
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
  /** Posti per unità; ignorato se postiIllimitati è true. */
  abitanti: number;
  /** Se true, la residenza ha capacità illimitata per unità (es. Baracca). */
  postiIllimitati?: boolean;
  /** Se impostato, solo abitanti di questa fazione possono vivere qui. */
  fazioneRichiesta?: string;
};

export const RESIDENZE_CATALOGO: ResidenzaTipo[] = [
  { id: "baracca", nome: "Baracca", nomePlurale: "Baracche", emoji: "📦", felicità: 5, costoMensile: AFFITTO_MENSILE_PER_RESIDENZA.Baracca ?? 0, abitanti: 0, postiIllimitati: true },
  { id: "capanna", nome: "Capanna", nomePlurale: "Capanne", emoji: "🏠", felicità: 8, costoMensile: AFFITTO_MENSILE_PER_RESIDENZA.Capanna ?? 0, abitanti: 30 },
  { id: "dormitorio", nome: "Dormitorio", nomePlurale: "Dormitori", emoji: "🛏️", felicità: 10, costoMensile: AFFITTO_MENSILE_PER_RESIDENZA.Dormitorio ?? 10, abitanti: 10 },
  { id: "modulo", nome: "Modulo", nomePlurale: "Moduli", emoji: "📦", felicità: 30, costoMensile: AFFITTO_MENSILE_PER_RESIDENZA.Modulo ?? 22, abitanti: 4 },
  { id: "villetta", nome: "Villetta", nomePlurale: "Villette", emoji: "🏡", felicità: 45, costoMensile: AFFITTO_MENSILE_PER_RESIDENZA.Villetta ?? 40, abitanti: 5 },
  { id: "attico", nome: "Attico", nomePlurale: "Attici", emoji: "🏢", felicità: 80, costoMensile: AFFITTO_MENSILE_PER_RESIDENZA.Attico ?? 80, abitanti: 3 },
  { id: "villa", nome: "Villa", nomePlurale: "Ville", emoji: "🏰", felicità: 120, costoMensile: AFFITTO_MENSILE_PER_RESIDENZA.Villa ?? 150, abitanti: 6 }
];
