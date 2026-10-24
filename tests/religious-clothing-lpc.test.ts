import test from "node:test";
import assert from "node:assert/strict";

import type { Abitante } from "../src/types";
import type { DogmaReligioso } from "../src/game/dogmiReligiosi";
import { ASPETTO_GIOCATORE_DEFAULT, creaCharacterAppearance } from "../src/game/personaggioAspetto";
import { canRenderCharacter } from "../src/character-system/registry";
import { abitoPrescrittoPerAbitante, indossaAbitoDellaFede } from "../src/game/vestiarioReligioso";
import { aggiornaSoddisfazioneDogmiAbiti, ID_DOGMA_ABITO_FEDELI } from "../src/game/reazioneDogmiAbiti";

const dogmi: DogmaReligioso[] = [
  { tipo: "abito_obbligatorio", destinatari: "fedeli", vestiti: "viandante" },
  { tipo: "abito_obbligatorio", destinatari: "sacerdoti", vestiti: "mago" }
];

function abitante(id: number, lavoro = "Raccoglitore"): Abitante {
  return {
    id, nome: "Abitante", lavoro, razza: "Umano", eta: 25, sesso: "M",
    religione: "Fede custom", salute: 100,
    aspetto: {
      ...ASPETTO_GIOCATORE_DEFAULT,
      vestiti: "ranger",
      characterAppearance: creaCharacterAppearance("Umano")
    }
  } as Abitante;
}

test("Il dogma clericale prevale sui fedeli e la norma generale vale senza dogma clericale", () => {
  assert.equal(abitoPrescrittoPerAbitante(abitante(1, "Sacerdote"), dogmi), "mago");
  assert.equal(abitoPrescrittoPerAbitante(abitante(2, "Druido"), dogmi), "mago");
  assert.equal(abitoPrescrittoPerAbitante(abitante(3, "Capo Religioso"), dogmi), "mago");
  assert.equal(abitoPrescrittoPerAbitante(abitante(4), dogmi), "viandante");
  assert.equal(abitoPrescrittoPerAbitante(abitante(5, "Sacerdote"), [dogmi[0]!]), "viandante");
});

test("La fede non equipaggia abiti senza una norma e non modifica il salvataggio originale", () => {
  const persona = abitante(6);
  assert.equal(indossaAbitoDellaFede(persona, []).ok, false);
  assert.equal(persona.aspetto?.vestiti, "ranger");
});

test("La Guardia mantiene la propria divisa, il Golem e il bambino non fingono abiti LPC", () => {
  const guardia = abitante(7, "Guardia");
  assert.equal(indossaAbitoDellaFede(guardia, dogmi).ok, false);
  assert.equal(guardia.aspetto?.vestiti, "ranger");
  assert.equal(indossaAbitoDellaFede({ ...abitante(8), razza: "Golem" }, dogmi).ok, false);
  assert.equal(indossaAbitoDellaFede({ ...abitante(9), eta: 8 }, dogmi).ok, false);
});

test("Cambio reale: aggiorna insieme abito salvato e outfit LPC renderizzabile", () => {
  const persona = abitante(10);
  const risultato = indossaAbitoDellaFede(persona, [dogmi[0]!]);
  assert.equal(risultato.ok, true, !risultato.ok ? risultato.motivo : "");
  if (!risultato.ok) return;
  assert.equal(risultato.abitante.aspetto?.vestiti, "viandante");
  assert.equal(risultato.abitante.aspetto?.characterAppearance?.upperOutfit, "commoner");
  assert.ok(canRenderCharacter(risultato.abitante.aspetto!.characterAppearance!, "idle"));
  assert.ok(canRenderCharacter(risultato.abitante.aspetto!.characterAppearance!, "walk"));
  assert.equal(persona.aspetto?.vestiti, "ranger");
});

test("Dopo il cambio abito la penalità religiosa sparisce e non si accumula", () => {
  const persona = abitante(11);
  const religioni = [{ nome: "Fede custom", dogmi: [dogmi[0]!] }] as unknown as Parameters<typeof aggiornaSoddisfazioneDogmiAbiti>[1];
  const prima = aggiornaSoddisfazioneDogmiAbiti([persona], religioni)[0]!;
  assert.equal(prima.modificatoriSoddisfazione?.some(x => x.id === ID_DOGMA_ABITO_FEDELI), true);
  const cambio = indossaAbitoDellaFede(prima, [dogmi[0]!]);
  assert.equal(cambio.ok, true);
  if (!cambio.ok) return;
  const dopo = aggiornaSoddisfazioneDogmiAbiti([cambio.abitante], religioni)[0]!;
  assert.equal(dopo.modificatoriSoddisfazione?.some(x => x.id === ID_DOGMA_ABITO_FEDELI) ?? false, false);
  assert.equal(aggiornaSoddisfazioneDogmiAbiti([dopo], religioni)[0], dopo);
});
