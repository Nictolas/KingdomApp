export type { EventoDef } from "./eventoTypes";
export { modificaRisorsa } from "./eventoTypes";

import type { EventoDef } from "./eventoTypes";
import { eventoProtesteAutoctoni } from "./protesteAutoctoni";
import { eventoAttentato } from "./attentato";
import { eventoCarestia } from "./carestia";
import { eventoPandemia } from "./pandemia";
import { eventoTempestaArcana } from "./tempestaArcana";
import { eventoMinacceGeopolitiche } from "./minacceGeopolitiche";
import { eventoAssimilazione } from "./assimilazione";
import { eventoEmigrazione } from "./emigrazione";
import { eventoRivoluzionariDelusi } from "./rivoluzionariDelusi";
import { eventoGuerraCivile } from "./guerraCivile";

/** Catalogo eventi attivati allo Skip Mese. La Richiesta Luogo di Culto è immediata (vedi useGameState). */
export const EVENTI_CATALOGO: EventoDef[] = [
  eventoProtesteAutoctoni,
  eventoAttentato,
  eventoCarestia,
  eventoPandemia,
  eventoTempestaArcana,
  eventoMinacceGeopolitiche,
  eventoAssimilazione,
  eventoEmigrazione,
  eventoRivoluzionariDelusi,
  eventoGuerraCivile
];

export { eventoRichiestaLuogoCulto } from "./richiestaLuogoCulto";
