import assert from "node:assert/strict";
import test from "node:test";
import {
  avanzaCostruzioniEdifici,
  PUNTI_PER_EDILE_PER_ORA
} from "../src/game/costruzioneEdifici";
import type { Edificio } from "../src/types";

function edificio(input: Partial<Edificio> & Pick<Edificio, "id" | "nome">): Edificio {
  return {
    id: input.id,
    nome: input.nome,
    emoji: input.emoji ?? "🏗️",
    tipo: input.tipo ?? "Infrastruttura",
    descrizione: input.descrizione ?? "",
    capacità: input.capacità ?? 0,
    occupazione: input.occupazione ?? 0,
    abitantiAssegnati: input.abitantiAssegnati ?? [],
    efficienza: input.efficienza ?? 100,
    manutenzione: input.manutenzione ?? 0,
    stato: input.stato ?? "Operativo",
    livello: input.livello ?? 1,
    ...input
  } as Edificio;
}

test("ogni Edile aggiunge 1 punto per ogni ora al primo cantiere", () => {
  const edifici = [
    edificio({ id: 1, nome: "Ufficio Edile", abitantiAssegnati: [10, 11] }),
    edificio({ id: 2, nome: "Ponte", stato: "In costruzione", progressoCostruzione: 20 })
  ];

  const result = avanzaCostruzioniEdifici(edifici, [], 3);
  const ponte = result.edifici.find((e) => e.id === 2)!;

  assert.equal(PUNTI_PER_EDILE_PER_ORA, 1);
  assert.equal(ponte.progressoCostruzione, 26);
});

test("completa un cantiere e usa le ore residue sul successivo", () => {
  const edifici = [
    edificio({ id: 1, nome: "Ufficio Edile", abitantiAssegnati: [10, 11] }),
    edificio({ id: 2, nome: "Ponte", stato: "In costruzione", progressoCostruzione: 98 }),
    edificio({ id: 3, nome: "Serra", stato: "In costruzione", progressoCostruzione: 0 })
  ];

  const result = avanzaCostruzioniEdifici(edifici, [], 2);
  const ponte = result.edifici.find((e) => e.id === 2)!;
  const serra = result.edifici.find((e) => e.id === 3)!;

  assert.equal(ponte.stato, "Operativo");
  assert.equal(ponte.progressoCostruzione, undefined);
  assert.equal(serra.progressoCostruzione, 2);
  assert.deepEqual(result.completati, [{ id: 2, nome: "Ponte" }]);
});
