import { describe, expect, it } from "vitest";
import type { Abitante } from "../src/types";
import {
  applicaEsitoChiacchiera,
  coppiaConPregiudizioChiacchiera
} from "../src/game/relazioneChiacchiera";

function base(partial: Partial<Abitante> & Pick<Abitante, "id" | "nome">): Abitante {
  return {
    emoji: "👤",
    eta: 30,
    lavoro: "Disoccupato",
    competenza: 50,
    produttività: 50,
    stanchezza: 0,
    personalità: "Neutrale",
    amici: [],
    rivali: [],
    fazioni: [],
    peso: 50,
    salute: 80,
    paura: 0,
    ...partial
  } as Abitante;
}

describe("relazioneChiacchiera", () => {
  it("rileva pregiudizio Omofobo vs Omo", () => {
    const a = base({ id: 1, nome: "A", personalità: "Omofobo" });
    const b = base({ id: 2, nome: "B", orientamento: "Omo" });
    expect(coppiaConPregiudizioChiacchiera(a, b)).toBe(true);
  });

  it("rileva pregiudizio Razzista vs razza diversa", () => {
    const a = base({ id: 1, nome: "A", personalità: "Razzista", razza: "Umano" });
    const b = base({ id: 2, nome: "B", razza: "Elfo" });
    expect(coppiaConPregiudizioChiacchiera(a, b)).toBe(true);
  });

  it("con pregiudizio crea o aumenta rivalità (rng sempre effetto)", () => {
    const a = base({ id: 1, nome: "A", personalità: "Omofobo" });
    const b = base({ id: 2, nome: "B", orientamento: "Bi" });
    const { a: nextA, b: nextB, esito } = applicaEsitoChiacchiera(a, b, () => 0);
    expect(esito.tipo).not.toBe("nessuno");
    expect(nextA.rivali.some((r) => r.id === 2)).toBe(true);
    expect(nextB.rivali.some((r) => r.id === 1)).toBe(true);
    expect(nextA.amici.some((r) => r.id === 2)).toBe(false);
  });

  it("senza relazione crea sempre un rapporto", () => {
    const a = base({ id: 1, nome: "A" });
    const b = base({ id: 2, nome: "B" });
    const { esito, a: nextA } = applicaEsitoChiacchiera(a, b, () => 0.99);
    expect(esito.tipo).toBe("creata");
    expect((nextA.amici?.length ?? 0) + (nextA.rivali?.length ?? 0)).toBe(1);
  });

  it("con relazione già presente può non fare nulla", () => {
    const a = base({ id: 1, nome: "A", amici: [{ id: 2, punteggio: 20 }] });
    const b = base({ id: 2, nome: "B", amici: [{ id: 1, punteggio: 20 }] });
    const { esito } = applicaEsitoChiacchiera(a, b, () => 0.99);
    expect(esito.tipo).toBe("nessuno");
  });
});
