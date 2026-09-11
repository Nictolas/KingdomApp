import assert from "node:assert/strict";
import test from "node:test";

import {
  abitantePuoEntrareAlBar,
  COSTO_BAR_MONETE,
  pagaIngressoBar,
  provaAssumiPrimoArrivoComeBaristaSeVuoto,
  raggruppaBaristiInServizioPerBar
} from "../src/game/barEconomia.ts";
import {
  aggiungiIncassoImpresa,
  getCassaImpresa,
  pagaFissoEDistribuisciTipBar,
  pagaStipendiImpresaGiornalieri,
  prelevaTassaImpresaMensile,
  seedCassaImpresaSeMancante
} from "../src/game/impresaCassa.ts";
import { isEdificioImpresa, isEdificioPubblicoConPostazioniLavoro } from "../src/game/edificiLavoro.ts";
import { getMoneteInventarioAbitante } from "../src/game/inventario.ts";
import { CASSA_IMPRESA_SEED, TASSA_IMPRESA_PERCENTUALE } from "../src/game/economiaPrezzi.ts";
import type { Abitante, Edificio } from "../src/types.ts";

function stub(partial: Partial<Abitante> & Pick<Abitante, "id" | "nome" | "lavoro">): Abitante {
  return {
    eta: 30,
    sesso: "M",
    razza: "Umano",
    felicità: 50,
    paura: 0,
    produttività: 50,
    competenza: 50,
    stanchezza: 0,
    personalità: "Tiepido",
    religione: "Ateo",
    orientamento: "Etero",
    fazioni: [],
    inventario: [{ itemId: "monete", quantità: 5 }],
    reddito: 0,
    spese: 0,
    peso: 50,
    salute: 80,
    emoji: "🧑",
    amici: [],
    rivali: [],
    ...partial
  } as Abitante;
}

function stubEdificio(partial: Partial<Edificio> & Pick<Edificio, "id" | "nome">): Edificio {
  return {
    emoji: "🏢",
    tipo: "Svago",
    descrizione: "",
    capacità: 4,
    occupazione: 0,
    abitantiAssegnati: [],
    efficienza: 80,
    manutenzione: 0,
    stato: "Operativo",
    livello: 1,
    stipendioPerLavoratore: 30,
    cassaMonete: CASSA_IMPRESA_SEED,
    ...partial
  };
}

test("ingresso bar costa 1 moneta", () => {
  assert.equal(COSTO_BAR_MONETE, 1);
  const a = stub({ id: 1, nome: "A", lavoro: "Disoccupato", inventario: [{ itemId: "monete", quantità: 3 }] });
  assert.equal(abitantePuoEntrareAlBar(a), true);
  const dopo = pagaIngressoBar(a);
  assert.ok(dopo);
  assert.equal(getMoneteInventarioAbitante(dopo!.inventario), 2);
});

test("senza monete non si entra al bar", () => {
  const a = stub({ id: 2, nome: "B", lavoro: "Disoccupato", inventario: [{ itemId: "monete", quantità: 0 }] });
  assert.equal(abitantePuoEntrareAlBar(a), false);
  assert.equal(pagaIngressoBar(a), null);
});

test("imprese escluse dagli stipendi pubblici", () => {
  const bar = stubEdificio({
    id: 17,
    nome: "Bar",
    categoriaEconomica: "Impresa",
    abitantiAssegnati: [1]
  });
  const serra = stubEdificio({
    id: 2,
    nome: "Serra",
    tipo: "Agricoltura",
    abitantiAssegnati: [2]
  });
  assert.equal(isEdificioImpresa(bar), true);
  assert.equal(isEdificioPubblicoConPostazioniLavoro(bar), false);
  assert.equal(isEdificioPubblicoConPostazioniLavoro(serra), true);
});

test("seed cassa impresa", () => {
  const raw = stubEdificio({ id: 35, nome: "Emporio", categoriaEconomica: "Impresa", cassaMonete: undefined });
  const seeded = seedCassaImpresaSeMancante(raw);
  assert.equal(seeded.cassaMonete, CASSA_IMPRESA_SEED);
});

test("incasso bar aumenta cassa e fatturato", () => {
  const bar = stubEdificio({ id: 17, nome: "Bar", categoriaEconomica: "Impresa", cassaMonete: 0 });
  const dopo = aggiungiIncassoImpresa(bar, 5);
  assert.equal(getCassaImpresa(dopo), 5);
  assert.equal(dopo.fatturatoMeseMonete, 5);
});

test("fine turno bar: fisso poi tip residuo", () => {
  const abitanti = new Map<number, Abitante>([
    [10, stub({ id: 10, nome: "B1", lavoro: "Barista", inventario: [{ itemId: "monete", quantità: 0 }] })],
    [11, stub({ id: 11, nome: "B2", lavoro: "Barista", inventario: [{ itemId: "monete", quantità: 0 }] })]
  ]);
  const bar = stubEdificio({
    id: 17,
    nome: "Bar",
    categoriaEconomica: "Impresa",
    cassaMonete: 7,
    stipendioPerLavoratore: 30,
    abitantiAssegnati: [10, 11]
  });
  const edifici = pagaFissoEDistribuisciTipBar([bar], { 17: [10, 11] }, (id, fn) => {
    abitanti.set(id, fn(abitanti.get(id)!));
  });
  // 7 cassa: fisso 1+1 = 2, restano 5 → tip 2+2, resto 1
  assert.equal(getMoneteInventarioAbitante(abitanti.get(10)!.inventario), 3);
  assert.equal(getMoneteInventarioAbitante(abitanti.get(11)!.inventario), 3);
  assert.equal(getCassaImpresa(edifici[0]!), 1);
});

test("senza baristi in servizio la cassa non viene svuotata", () => {
  const bar = stubEdificio({ id: 17, nome: "Bar", categoriaEconomica: "Impresa", cassaMonete: 3 });
  const edifici = pagaFissoEDistribuisciTipBar([bar], { 17: [] }, () => {
    throw new Error("non dovrebbe aggiornare abitanti");
  });
  assert.equal(getCassaImpresa(edifici[0]!), 3);
});

test("stipendi emporio da cassa insufficiente: pro-rata", () => {
  const mercante = stub({
    id: 20,
    nome: "M",
    lavoro: "Mercante",
    inventario: [{ itemId: "monete", quantità: 0 }]
  });
  const emporio = stubEdificio({
    id: 35,
    nome: "Emporio",
    categoriaEconomica: "Impresa",
    cassaMonete: 1,
    stipendioPerLavoratore: 30,
    abitantiAssegnati: [20]
  });
  const r = pagaStipendiImpresaGiornalieri([mercante], [emporio], 1);
  assert.equal(getMoneteInventarioAbitante(r.abitanti[0]!.inventario), 1);
  assert.equal(getCassaImpresa(r.edifici[0]!), 0);
});

test("tassa impresa mensile sul fatturato", () => {
  const bar = stubEdificio({
    id: 17,
    nome: "Bar",
    categoriaEconomica: "Impresa",
    cassaMonete: 100,
    fatturatoMeseMonete: 50
  });
  const r = prelevaTassaImpresaMensile([bar], 0, TASSA_IMPRESA_PERCENTUALE);
  assert.equal(r.gettito, 5);
  assert.equal(r.moneteGiocatore, 5);
  assert.equal(r.edifici[0]!.fatturatoMeseMonete, 0);
  assert.equal(getCassaImpresa(r.edifici[0]!), 95);
});

test("bar vuoto: Disoccupato o Raccoglitore diventano barista", () => {
  const raccoglitore = stub({
    id: 50,
    nome: "Scheletro",
    lavoro: "Raccoglitore",
    casta: "Cittadino",
    inventario: [{ itemId: "monete", quantità: 5 }]
  });
  const bosco = stubEdificio({
    id: 51,
    nome: "Bosco",
    abitantiAssegnati: [50],
    occupazione: 1,
    capacità: 20
  });
  const bar = stubEdificio({
    id: 17,
    nome: "Bar",
    categoriaEconomica: "Impresa",
    abitantiAssegnati: [],
    occupazione: 0,
    capacità: 20
  });
  const r = provaAssumiPrimoArrivoComeBaristaSeVuoto([raccoglitore], [bosco, bar], 50, 17);
  assert.equal(r.assunto, true);
  assert.equal(r.abitanti[0]!.lavoro, "Barista");
  assert.deepEqual(r.edifici.find((e) => e.id === 17)!.abitantiAssegnati, [50]);
  assert.deepEqual(r.edifici.find((e) => e.id === 51)!.abitantiAssegnati, []);
});

test("bar vuoto: Mercante non diventa barista", () => {
  const mercante = stub({
    id: 52,
    nome: "M",
    lavoro: "Mercante",
    casta: "Cittadino"
  });
  const bar = stubEdificio({
    id: 17,
    nome: "Bar",
    categoriaEconomica: "Impresa",
    abitantiAssegnati: [],
    capacità: 20
  });
  const r = provaAssumiPrimoArrivoComeBaristaSeVuoto([mercante], [bar], 52, 17);
  assert.equal(r.assunto, false);
  assert.equal(r.abitanti[0]!.lavoro, "Mercante");
});

test("bar già con barista: entrante resta cliente (non assunto)", () => {
  const cliente = stub({
    id: 51,
    nome: "C",
    lavoro: "Disoccupato",
    casta: "Cittadino"
  });
  const bar = stubEdificio({
    id: 17,
    nome: "Bar",
    categoriaEconomica: "Impresa",
    abitantiAssegnati: [99],
    occupazione: 1,
    capacità: 20
  });
  const r = provaAssumiPrimoArrivoComeBaristaSeVuoto([cliente], [bar], 51, 17);
  assert.equal(r.assunto, false);
  assert.equal(r.abitanti[0]!.lavoro, "Disoccupato");
});

test("raggruppa baristi per bar di assegnazione", () => {
  const edifici = [
    stubEdificio({ id: 17, nome: "Bar", abitantiAssegnati: [101, 102] }),
    stubEdificio({ id: 2, nome: "Serra", tipo: "Agricoltura", abitantiAssegnati: [103] })
  ];
  const groups = raggruppaBaristiInServizioPerBar([101, 102, 103], edifici);
  assert.deepEqual(groups[17]?.sort((a, b) => a - b), [101, 102]);
  assert.equal(groups[2], undefined);
});
