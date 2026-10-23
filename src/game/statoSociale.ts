import type { Abitante } from "../types";

/** 0..100. I vecchi salvataggi utilizzavano la chiave paura. */
export function timoreAbitante(a: Abitante): number {
  const valore = a.timore ?? a.paura ?? 0;
  return Number.isFinite(valore) ? Math.max(0, Math.min(100, Math.round(valore))) : 0;
}

/** Il Timore diminuisce la propensione a ribellarsi, senza rendere immuni. */
export function propensioneRibellione(a: Abitante): number {
  return 1 - 0.75 * timoreAbitante(a) / 100;
}

/** Migrazione idempotente: integra il consenso storico nella Soddisfazione e abbandona gli indici duplicati. */
export function normalizzaStatoSociale(a: Abitante): Abitante {
  const { felicità, lealtà, paura, ...rest } = a;
  const timore = timoreAbitante(a);
  const mods = [...(a.modificatoriSoddisfazione ?? [])];
  if (!mods.some(m => m.id === "consenso_legacy") && (typeof felicità === "number" || typeof lealtà === "number")) {
    const valori = [felicità, lealtà].filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const delta = Math.max(-3, Math.min(3, Math.round((valori.reduce((s,v) => s + v, 0) / valori.length - 50) / 20)));
    if (valori.length > 0 && a.razza !== "Golem" && Number.isFinite(delta) && delta !== 0) {
      mods.push({ id: "consenso_legacy", delta, motivo: "Consenso precedente (salvataggio migrato)", durata: "permanente" });
    }
  }
  return { ...rest, timore, modificatoriSoddisfazione: mods.length > 0 ? mods : undefined };
}
