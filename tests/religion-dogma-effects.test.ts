import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { Abitante, Edificio } from "../src/types";
import {
  provaCreaReligioneCustom, normalizzaReligioniCustom, modificaDogmiReligioneCustom
} from "../src/game/fedeleCulto";
import {
  normalizzaDogmiReligiosi, vietatoCiboDaDogma, abitoPrescrittoDaDogma
} from "../src/game/dogmiReligiosi";
import {
  aggiornaSoddisfazioneDogmiAbiti, ID_DOGMA_ABITO_FEDELI,
  ID_DOGMA_ABITO_SACERDOTI
} from "../src/game/reazioneDogmiAbiti";
import { consumaUnOggettoCiboConItem } from "../src/game/inventario";
import { consumaPastoDaInventarioMensa } from "../src/game/mensaPubblica";
import { applicaPastiGiornalieriPerPeriodo } from "../src/game/pastoGiornaliero";

const creazione = provaCreaReligioneCustom({
  nome: "Ordine delle Erbe",
  fondatoreReId: 1,
  dogmi: [
    { tipo: "alimento_vietato", itemId: "bistecca" },
    { tipo: "abito_obbligatorio", destinatari: "fedeli", vestiti: "ranger" },
    { tipo: "abito_obbligatorio", destinatari: "sacerdoti", vestiti: "mago" },
    { tipo: "sovrano_rappresentante_divino" }
  ]
}, [], () => "ord-1");
if (!creazione.ok) throw new Error(creazione.errore);
const fede = creazione.religione;
const persona = (id: number, lavoro: string, vestiti: string) => ({
  id, nome: "Abitante " + id, religione: fede.nome, lavoro,
  aspetto: { vestiti },
  salute: 100, personalità: "Neutrale", casta: "Cittadino"
}) as Abitante;

test("Validazione del dogma ignora cibi inesistenti, valori arbitrari e duplicati", () => {
  const base = normalizzaDogmiReligiosi([
    { tipo: "alimento_vietato", itemId: "bistecca" },
    { tipo: "alimento_vietato", itemId: "bistecca" },
    { tipo: "alimento_vietato", itemId: "monete" },
    { tipo: "alimento_vietato", itemId: "inesistente" },
    { tipo: "abito_obbligatorio", destinatari: "fedeli", vestiti: "armatura_inventata" },
    { tipo: "sovrano_rappresentante_divino" }
  ]);
  assert.equal(base.length, 2);
  assert.ok(vietatoCiboDaDogma(base, "bistecca"));
  assert.ok(!vietatoCiboDaDogma(base, "mela"));
  assert.equal(abitoPrescrittoDaDogma(fede.dogmi ?? [], "sacerdoti"), "mago");
});

test("Fede, versioni e dogmi rimangono coerenti nei salvataggi legacy e revisionati", () => {
  const conservata = normalizzaReligioniCustom([fede])[0]!;
  assert.equal(conservata.fondatoreReId, 1);
  assert.equal(conservata.dogmi?.length, 4);
  const nuova = modificaDogmiReligioneCustom([conservata], fede.id, [
    { tipo: "alimento_vietato", itemId: "mela" }
  ]);
  assert.equal(nuova[0]?.versioneDogmi, 2);
  assert.equal(nuova[0]?.fondatoreReId, 1);
  assert.equal(nuova[0]?.dogmi?.length, 1);
  assert.equal(normalizzaReligioniCustom([{ id: "legacy", nome: "Antico" }])[0]?.dogmi, undefined);
});

test("Abiti obbligatori modificano soddisfazione solo in caso di violazione e non si accumulano", () => {
  const normale = persona(11, "Raccoglitore", "viandante");
  const conforme = persona(12, "Contadino", "ranger");
  const sacerdote = persona(13, "Sacerdote", "viandante");
  const nuovi = aggiornaSoddisfazioneDogmiAbiti([normale, conforme, sacerdote], [fede]);
  assert.equal(nuovi[0]!.modificatoriSoddisfazione?.find(x => x.id === ID_DOGMA_ABITO_FEDELI)?.delta, -2);
  assert.equal(nuovi[1], conforme);
  assert.equal(nuovi[2]!.modificatoriSoddisfazione?.find(x => x.id === ID_DOGMA_ABITO_SACERDOTI)?.delta, -3);
  assert.equal(aggiornaSoddisfazioneDogmiAbiti(nuovi, [fede]), nuovi);
  const guarito = aggiornaSoddisfazioneDogmiAbiti([
    { ...nuovi[0]!, aspetto: { ...nuovi[0]!.aspetto!, vestiti: "ranger" } }
  ], [fede]);
  assert.equal(guarito[0]?.modificatoriSoddisfazione, undefined);
});

test("Un alimento proibito non viene consumato né dall'inventario né dalla mensa", () => {
  const permesso = (itemId: string) => !vietatoCiboDaDogma(fede.dogmi ?? [], itemId);
  const proprie = consumaUnOggettoCiboConItem([
    { itemId: "bistecca", quantità: 2 },
    { itemId: "mela", quantità: 2 }
  ], "Neutrale", permesso)!;
  assert.ok(proprie);
  assert.notEqual(proprie.itemId, "bistecca");
  assert.equal(proprie.inventario.find(v => v.itemId === "bistecca")?.quantità, 2);
  const mensa = consumaPastoDaInventarioMensa([
    { itemId: "bistecca", quantità: 2 }, { itemId: "mela", quantità: 1 }
  ], "Neutrale", permesso)!;
  assert.equal(mensa.itemId, "mela");
  assert.equal(mensa.inventarioMensa.find(v => v.itemId === "bistecca")?.quantità, 2);
});

test("Il ciclo giornaliero considera la religione specifica di ciascun abitante", () => {
  const fedele = {
    ...persona(18, "Raccoglitore", "ranger"),
    inventario: [{ itemId: "mela", quantità: 2 }, { itemId: "bistecca", quantità: 2 }],
    ultimoGiornoCiboConsumato: 0
  };
  const esito = applicaPastiGiornalieriPerPeriodo(
    [fedele], [] as Edificio[], {}, {}, 0, 1, [fede]
  );
  assert.equal(esito.abitanti[0]?.ultimoGiornoCiboConsumato, 1);
  assert.equal(esito.abitanti[0]?.inventario?.find(v => v.itemId === "bistecca")?.quantità, 2);
});

test("Editor e stato di gioco passano dogmi a pasti, abiti e Teocrazia", () => {
  const ui = readFileSync("app/religioni.tsx", "utf8");
  const game = readFileSync("src/hooks/useGameState.ts", "utf8");
  const obiettivi = readFileSync("src/data/obiettiviCatalogo.ts", "utf8");
  assert.match(ui, /Modifica dogmi/);
  assert.match(ui, /alimento_vietato/);
  assert.match(ui, /abito_obbligatorio/);
  assert.match(game, /aggiornaSoddisfazioneDogmiAbiti/);
  assert.match(game, /religioniCustomRef\.current/);
  assert.match(obiettivi, /id: "teocrazia"/);
});
