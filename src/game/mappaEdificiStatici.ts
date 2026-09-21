import type { EdificioInCellaMappa } from "./mappaTypes";

export const GIACIMENTO: EdificioInCellaMappa = { id: 0, nome: "Giacimento", emoji: "⛰️" };
export const RAFFINERIA_MINERARIA: EdificioInCellaMappa = {
  id: 3,
  nome: "Raffineria Mineraria",
  emoji: "⚙️"
};
/** Opzione "Strada" per il dialog costruzione (cella diventa lastricato strada). */
export const STRADA_OPZIONE: EdificioInCellaMappa = { id: -1, nome: "Strada", emoji: "🛤️" };

export const DORMITORIO: EdificioInCellaMappa = { id: 14, nome: "Dormitorio", emoji: "🛏️" };
export const BAR_EDIFICIO: EdificioInCellaMappa = { id: 17, nome: "Bar", emoji: "🍺" };
export const TRIBUNALE_EDIFICIO: EdificioInCellaMappa = { id: 12, nome: "Tribunale", emoji: "⚖️" };
export const SERRA_EDIFICIO: EdificioInCellaMappa = { id: 2, nome: "Serra", emoji: "🌱" };
export const SERRA_2_EDIFICIO: EdificioInCellaMappa = { id: 21, nome: "Serra", emoji: "🌱" };
export const CAPANNA: EdificioInCellaMappa = { id: 20, nome: "Capanna", emoji: "⛺" };

/** Emoji per decorazioni procedurali sulla mappa (alberi, palme, cactus, vulcano). */
export const DECORAZIONI_EMOJI = ["🌳", "🌲", "🌴", "🌵", "🌋"] as const;
