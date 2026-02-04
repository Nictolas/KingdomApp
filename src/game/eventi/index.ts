export type { EventoDef } from "./eventoTypes";
export { modificaRisorsa } from "./eventoTypes";

import type { EventoDef } from "./eventoTypes";
import { eventoProtesteAutoctoni } from "./protesteAutoctoni";
import { eventoAttentato } from "./attentato";
import { eventoCarestia } from "./carestia";
import { eventoPandemia } from "./pandemia";
import { eventoTempestaSolare } from "./tempestaSolare";
import { eventoMinacceGeopolitiche } from "./minacceGeopolitiche";
import { eventoAssimilazione } from "./assimilazione";
import { eventoEmigrazione } from "./emigrazione";
import { eventoRivoluzionariDelusi } from "./rivoluzionariDelusi";

/** Catalogo di tutti gli eventi: aggiungi qui i nuovi eventi. */
export const EVENTI_CATALOGO: EventoDef[] = [
  eventoProtesteAutoctoni,
  eventoAttentato,
  eventoCarestia,
  eventoPandemia,
  eventoTempestaSolare,
  eventoMinacceGeopolitiche,
  eventoAssimilazione,
  eventoEmigrazione,
  eventoRivoluzionariDelusi
];
