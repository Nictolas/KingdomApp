import type { Abitante, Edificio } from "../types";
import type { VoceInventario } from "./inventario";
import {
  aggiungiCiboAInventarioGiocatore,
  aggiungiOggettoInventarioAbitante
} from "./inventario";
import {
  COLTURA_SERRA_DEFAULT,
  getColturaSerraDef,
  GIORNI_PRODUZIONE_SERRA_PER_MESE,
  isColturaSerraValida,
  PRODUZIONE_SERRA_GIORNALIERA
} from "./colturaSerra";
import { applicaMoltiplicatoreProduzione } from "./reModalita";

export const LAVORO_AGRICOLTORE = "Agricoltore";

export type VoceRaccoltoSerra = {
  itemId: string;
  emoji: string;
  nome: string;
  quantità: number;
};

export type BottinoSerraRegistrato = {
  abitanteId: number;
  abitanteNome: string;
  serraId: number;
  voci: VoceRaccoltoSerra[];
};

export function isSerraOperativa(edificio: Edificio): boolean {
  return edificio.nome === "Serra" && edificio.stato === "Operativo";
}

export function getColturaItemIdSerra(edificio: Edificio): string | null {
  if (!isSerraOperativa(edificio)) return null;
  const id = edificio.colturaItemId ?? COLTURA_SERRA_DEFAULT;
  return isColturaSerraValida(id) ? id : null;
}

function voceColturaSerra(edificio: Edificio): VoceRaccoltoSerra | null {
  const itemId = getColturaItemIdSerra(edificio);
  if (!itemId) return null;
  const def = getColturaSerraDef(itemId);
  if (!def) return null;
  return {
    itemId: def.id,
    emoji: def.emoji,
    nome: def.nome,
    quantità: PRODUZIONE_SERRA_GIORNALIERA
  };
}

function quantitaGiornalieraConBuff(
  edificio: Edificio,
  edificioBuffVisitaId?: number | null
): number {
  return applicaMoltiplicatoreProduzione(
    PRODUZIONE_SERRA_GIORNALIERA,
    edificio.id === edificioBuffVisitaId
  );
}

/** Agricoltori assegnati a Serre operative (id abitante → Serra). */
function mappaAgricoltoriSerra(edifici: Edificio[]): Map<number, Edificio> {
  const out = new Map<number, Edificio>();
  for (const edificio of edifici) {
    if (!getColturaItemIdSerra(edificio)) continue;
    for (const id of edificio.abitantiAssegnati ?? []) out.set(id, edificio);
  }
  return out;
}

/**
 * Produzione giornaliera storica: ogni Agricoltore assegnato a una Serra operativa
 * riceve la coltura nell'inventario personale.
 */
export function applicaProduzioneSerraGiornaliera(
  abitanti: Abitante[],
  edifici: Edificio[],
  giornoCorrente: number,
  giorni: number,
  edificioBuffVisitaId?: number | null
): { abitanti: Abitante[]; messaggi: string[]; bottini: BottinoSerraRegistrato[] } {
  if (giorni <= 0) return { abitanti, messaggi: [], bottini: [] };
  const perAgricoltore = mappaAgricoltoriSerra(edifici);
  if (perAgricoltore.size === 0) return { abitanti, messaggi: [], bottini: [] };

  const messaggi: string[] = [];
  const bottini: BottinoSerraRegistrato[] = [];
  const abitantiNext = abitanti.map((a) => {
    const serra = perAgricoltore.get(a.id);
    if (!serra || a.lavoro !== LAVORO_AGRICOLTORE) return a;
    const base = voceColturaSerra(serra);
    if (!base) return a;

    let next = a;
    for (let g = 0; g < giorni; g++) {
      const giorno = giornoCorrente - giorni + g + 1;
      if (next.ultimoRaccoltoSerra?.giorno === giorno) continue;
      const quantità = quantitaGiornalieraConBuff(serra, edificioBuffVisitaId);
      const voci: VoceRaccoltoSerra[] = [{ ...base, quantità }];
      for (const v of voci) {
        next = aggiungiOggettoInventarioAbitante(next, v.itemId, v.quantità);
      }
      next = { ...next, ultimoRaccoltoSerra: { giorno, voci } };
      bottini.push({
        abitanteId: a.id,
        abitanteNome: a.nome,
        serraId: serra.id,
        voci
      });
      if (g === giorni - 1) {
        const etichetta = voci
          .map((v) => `${v.emoji} ${v.nome}${v.quantità > 1 ? ` ×${v.quantità}` : ""}`)
          .join(", ");
        messaggi.push(`${a.nome} ha raccolto ${etichetta} nella Serra.`);
      }
    }
    return next;
  });

  return { abitanti: abitantiNext, messaggi, bottini };
}

/** Produzione aggregata teorica di tutti gli Agricoltori nel periodo. */
export function calcolaProduzioneSerraPerPeriodo(
  edifici: Edificio[],
  giorni: number,
  edificioBuffVisitaId?: number | null
): Map<string, number> {
  const out = new Map<string, number>();
  if (giorni <= 0) return out;

  for (const edificio of edifici) {
    const coltura = getColturaItemIdSerra(edificio);
    if (!coltura) continue;
    const lavoratori = (edificio.abitantiAssegnati ?? []).length;
    if (lavoratori <= 0) continue;
    const qtyGiorno = quantitaGiornalieraConBuff(edificio, edificioBuffVisitaId);
    const qty = qtyGiorno * giorni * lavoratori;
    out.set(coltura, (out.get(coltura) ?? 0) + qty);
  }
  return out;
}

export function calcolaProduzioneSerraMensile(
  edifici: Edificio[],
  edificioBuffVisitaId?: number | null
): number {
  let tot = 0;
  for (const edificio of edifici) {
    if (!getColturaItemIdSerra(edificio)) continue;
    const lavoratori = (edificio.abitantiAssegnati ?? []).length;
    if (lavoratori <= 0) continue;
    tot +=
      quantitaGiornalieraConBuff(edificio, edificioBuffVisitaId) *
      GIORNI_PRODUZIONE_SERRA_PER_MESE *
      lavoratori;
  }
  return tot;
}

/** @deprecated La produzione storica va negli inventari degli Agricoltori. */
export function applicaProduzioneSerraInventarioGiocatore(
  inventario: VoceInventario[],
  produzione: Map<string, number>
): VoceInventario[] {
  let next = inventario;
  for (const [itemId, quantità] of produzione) {
    if (quantità > 0) next = aggiungiCiboAInventarioGiocatore(next, itemId, quantità);
  }
  return next;
}
