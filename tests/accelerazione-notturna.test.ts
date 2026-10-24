import assert from "node:assert/strict";
import test from "node:test";
import type { Abitante, Edificio } from "../src/types";
import type { StatoRientroNotturno } from "../src/game/accelerazioneNotturna";
import {
  abitanteNelCastelloDiNotte,
  tuttiGliAbitantiSonoACasaDiNotte
} from "../src/game/accelerazioneNotturna";

const re = { id: 1, lavoro: "Re" } as Abitante;
const consigliere = { id: 2, lavoro: "Consigliere" } as Abitante;
const cittadina = { id: 3, lavoro: "Disoccupato" } as Abitante;
const guardia = { id: 4, lavoro: "Guardia" } as Abitante;
const castello = {
  id: 1,
  nome: "Castello",
  stato: "Operativo",
  abitantiAssegnati: [1, 2, 4]
} as Edificio;

function stato(patch: Partial<StatoRientroNotturno> = {}): StatoRientroNotturno {
  return {
    notte: true,
    abitanti: [re, consigliere, cittadina],
    edifici: [castello],
    modalitaRe: "nel_castello",
    dormonoACasaIds: new Set([3]),
    cellaCasaPerAbitanteId: new Map([[3, 120]]),
    commuteByAbitanteId: {},
    ...patch
  };
}

test("il Castello è casa del Re e del Consigliere, ma non delle Guardie", () => {
  assert.equal(abitanteNelCastelloDiNotte(re, [castello], "nel_castello"), true);
  assert.equal(abitanteNelCastelloDiNotte(consigliere, [castello], "nel_castello"), true);
  assert.equal(abitanteNelCastelloDiNotte(guardia, [castello], "nel_castello"), false);
  assert.equal(abitanteNelCastelloDiNotte(re, [castello], "a_giro"), false);
});

test("di notte con tutti a casa si può accelerare; di giorno no", () => {
  assert.equal(tuttiGliAbitantiSonoACasaDiNotte(stato()), true);
  assert.equal(tuttiGliAbitantiSonoACasaDiNotte(stato({ notte: false })), false);
  assert.equal(tuttiGliAbitantiSonoACasaDiNotte(stato({ abitanti: [] })), false);
});

test("non accelera quando il Re è fuori dal Castello", () => {
  assert.equal(tuttiGliAbitantiSonoACasaDiNotte(stato({ modalitaRe: "a_giro" })), false);
  assert.equal(tuttiGliAbitantiSonoACasaDiNotte(stato({ modalitaRe: "in_visita" })), false);
});

test("non accelera se un abitante non è tornato oppure non ha casa", () => {
  assert.equal(
    tuttiGliAbitantiSonoACasaDiNotte(stato({ dormonoACasaIds: new Set() })),
    false
  );
  assert.equal(
    tuttiGliAbitantiSonoACasaDiNotte(stato({ cellaCasaPerAbitanteId: new Map() })),
    false
  );
  assert.equal(
    tuttiGliAbitantiSonoACasaDiNotte(
      stato({ commuteByAbitanteId: { 3: { purpose: "home", path: [12, 120], token: 1 } } })
    ),
    false
  );
  assert.equal(
    tuttiGliAbitantiSonoACasaDiNotte(stato({ abitanti: [re, consigliere, cittadina, guardia] })),
    false
  );
});

test("le Guardie con una vera casa e già rientrate non bloccano la notte", () => {
  assert.equal(
    tuttiGliAbitantiSonoACasaDiNotte(
      stato({
        abitanti: [re, consigliere, cittadina, guardia],
        cellaCasaPerAbitanteId: new Map([[3, 120], [4, 125]]),
        dormonoACasaIds: new Set([3, 4])
      })
    ),
    true
  );
});
