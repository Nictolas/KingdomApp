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
import {
  consumaPastoDaInventarioMensa, serviPastoMensaTransaction,
  abitanteHaBisognoMensa
} from "../src/game/mensaPubblica";
import { compraEMangiaAlNegozio, compraCiboAlNegozio, abitanteVuoleNegozio } from "../src/game/negozio";
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

test("Un rifiuto religioso alla mensa non genera un falso evento di carestia", () => {
  const fedele = persona(71, "Raccoglitore", "ranger");
  const menu = [{ itemId: "bistecca", quantità: 3 }];
  const permesso = (id: string) => !vietatoCiboDaDogma(fede.dogmi ?? [], id);
  const rifiutato = serviPastoMensaTransaction(fedele, menu, 3, permesso);
  assert.equal(rifiutato.servito, false);
  assert.equal(rifiutato.carestiaMensa, false);
  assert.equal(rifiutato.inventarioMensa.find(v => v.itemId === "bistecca")?.quantità, 3);
  const vuota = serviPastoMensaTransaction(fedele, [], 3, permesso);
  assert.equal(vuota.servito, false);
  assert.equal(vuota.carestiaMensa, true);
});

test("Il motore giornaliero distingue il cibo tabù da una reale mancanza di scorte", () => {
  const fedele = { ...persona(72, "Raccoglitore", "ranger"),
    inventario: [
      { itemId: "mela", quantità: 0 },
      { itemId: "bistecca", quantità: 0 },
      { itemId: "latte", quantità: 0 },
      { itemId: "uovo", quantità: 0 },
      { itemId: "monete", quantità: 0 }
    ],
    ultimoGiornoCiboConsumato: 0
  };
  const mensa = { id: 95, nome: "Mensa Pubblica", stato: "Operativo",
    abitantiAssegnati: [], capacità: 6 } as Edificio;
  const r = applicaPastiGiornalieriPerPeriodo(
    [fedele], [mensa], { 95: [{ itemId: "bistecca", quantità: 4 }] }, {},
    0, 1, [fede]
  );
  assert.equal(r.carestiaMensa, false);
  assert.equal(r.abitanti[0]?.ultimoGiornoCiboConsumato, 0);
  assert.equal(r.inventarioMensaByEdificioId[95]?.find(v => v.itemId === "bistecca")?.quantità, 4);
});

test("Negozio: il tabù del cibo base impedisce vendita, pagamento e consumo", () => {
  const cliente = { ...persona(90, "Raccoglitore", "ranger"),
    inventario: [{ itemId: "monete", quantità: 150 }] };
  const vietaMele = (id: string) => id !== "mela";
  assert.equal(compraEMangiaAlNegozio(cliente, vietaMele), null);
  assert.equal(compraCiboAlNegozio(cliente, vietaMele), null);
  assert.equal(abitanteVuoleNegozio(cliente, [
    { id: 91, nome: "Negozio", stato: "Operativo" } as Edificio
  ], vietaMele), false);
  assert.equal(cliente.inventario[0]?.quantità, 150);
});

test("L'abitante raggiunge la mensa se il suo unico alimento è proibito", () => {
  const fed = { ...persona(92, "Raccoglitore", "ranger"),
    inventario: [{ itemId: "bistecca", quantità: 3 }] };
  const mensa = { id: 93, nome: "Mensa Pubblica", stato: "Operativo" } as Edificio;
  assert.equal(abitanteHaBisognoMensa(fed, [mensa], [fede]), true);
  assert.equal(abitanteHaBisognoMensa(fed, [mensa]), false);
});

test("Ministri di culto seguono abito sacerdotale senza doppio malus incompatibile", () => {
  const sacerd = persona(94, "Sacerdote", "viandante");
  const valutato = aggiornaSoddisfazioneDogmiAbiti([sacerd], [fede])[0]!;
  assert.deepEqual(
    valutato.modificatoriSoddisfazione?.map(m => m.id),
    [ID_DOGMA_ABITO_SACERDOTI]
  );
  const vestito = persona(95, "Sacerdote", "mago");
  assert.equal(aggiornaSoddisfazioneDogmiAbiti([vestito], [fede])[0], vestito);
  const druido = persona(96, "Druido", "mago");
  assert.equal(aggiornaSoddisfazioneDogmiAbiti([druido], [fede])[0], druido);
});

test("Mappa e scheda abitante mostrano e applicano i dogmi su ogni percorso reale", () => {
  const mappa = readFileSync("app/mappa.tsx", "utf8");
  const scheda = readFileSync("src/ui/AbitanteInfoModal.tsx", "utf8");
  assert.match(mappa, /permessoCiboFedele\(a, religioniCustom\)/);
  assert.match(mappa, /abitanteHaBisognoMensa\(a, edifici, religioniCustom\)/);
  assert.match(mappa, /compraEMangiaAlNegozio\(a, permessoCiboFedele/);
  assert.match(scheda, /Abito della fede/);
  assert.match(scheda, /Alimenti vietati dalla fede/);
});
