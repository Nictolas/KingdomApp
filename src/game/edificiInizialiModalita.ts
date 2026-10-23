import type { Edificio } from "../types";
import type { GameMode } from "./gameMode";

export const NOMI_EDIFICI_AVVENTURA = new Set([
  "Castello",
  "Serra",
  "Capanna",
  "Porto",
  "Bosco",
  "Miniera",
  "Zecca",
  "Emporio",
  "Ufficio Edile",
  "Chiesa"
]);

export function filtraEdificiInizialiPerModalita(
  edifici: Edificio[],
  mode: GameMode
): Edificio[] {
  return edifici.filter((edificio) => {
    // Le basi forestali non esistono alla nascita del regno: il giocatore deve costruirle.
    if (new Set(["Capanna del Cacciatore", "Campo dei Taglialegna", "Capanno del Guardaboschi", "Erboristeria", "Apiario", "Vivaio forestale"]).has(edificio.nome)) return false;
    if (edificio.tipo === "Luogo di Culto") return false;
    if (edificio.nome === "Acquedotto" || edificio.nome === "Dissalatore" || edificio.nome === "Ponte") {
      return false;
    }
    if (mode !== "avventura") return true;
    if (edificio.nome === "Serra") return edificio.id === 2;
    return NOMI_EDIFICI_AVVENTURA.has(edificio.nome);
  });
}
