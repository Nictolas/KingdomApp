import assert from "node:assert/strict";
import test from "node:test";
import {
  makeBarterOffer, validateBarterOffer, encodeBarterWire, parseBarterWire,
  reserveLocalBarter, releaseLocalBarter, applyRemoteBarterMessageToStock,
  BARTER_PROTOCOL
} from "../src/multiplayer/barterProtocol.ts";

const proposerId = "0123456789abcdef0123456789abcdef";
const responderId = "abcdef0123456789abcdef0123456789";
const tradeId = "11111111111111111111111111111111";
function offer(gives = [{ resourceId: "wood", quantity: 100_000 }],
               wants = [{ resourceId: "iron", quantity: 10_000 }]) {
  return makeBarterOffer({ tradeId, proposerId, responderId, gives, wants });
}
function ledger(stock = { wood: 150_000, iron: 12_000 }, capacity = 200_000) {
  return { stock, capacity, reservations: {} };
}

test("100.000 legname per 10.000 ferro: quantità grandi ma valide", () => {
  const deal = offer();
  assert.equal(deal.gives[0].quantity, 100_000);
  assert.equal(deal.wants[0].quantity, 10_000);
  const roundtrip = parseBarterWire(encodeBarterWire({ protocol: BARTER_PROTOCOL, type: "propose", offer: deal }));
  assert.deepEqual(roundtrip.offer, deal);
  const reserved = reserveLocalBarter(ledger(), deal, "proposer");
  assert.equal(reserved.stock.wood, 150_000); // reservations MUST NOT mutate stock
  assert.equal(reserved.reservations[tradeId].status, "reserved");
});

test("reject invalid quantity, missing entries and duplicated resources", () => {
  for (const n of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => offer([{ resourceId: "wood", quantity: n }]), /Quantità/);
  }
  assert.throws(() => offer([]), /Elenco/);
  assert.throws(() => offer([{ resourceId: "wood", quantity: 1 }, { resourceId: "wood", quantity: 2 }]), /duplicata/);
  assert.throws(() => offer([{ resourceId: "../secrets", quantity: 1 }]), /Risorsa/);
});

test("identità e id di transazione: niente auto-baratto", () => {
  assert.throws(() => makeBarterOffer({ tradeId, proposerId, responderId: proposerId, gives: offer().gives, wants: offer().wants }), /stesso dispositivo/);
  assert.throws(() => makeBarterOffer({ tradeId: "42", proposerId, responderId, gives: offer().gives, wants: offer().wants }), /Identificativo/);
});

test("risposte round-trip, no commit remoto o messaggi oltre limite", () => {
  const yes = { protocol: BARTER_PROTOCOL, type: "respond", tradeId, accepted: true };
  assert.deepEqual(parseBarterWire(encodeBarterWire(yes)), yes);
  assert.throws(() => parseBarterWire(JSON.stringify({ ...yes, accepted: "yes" })), /Risposta/);
  assert.throws(() => parseBarterWire(JSON.stringify({ protocol: BARTER_PROTOCOL, type: "commit", tradeId })), /non autorizzato/);
  assert.throws(() => parseBarterWire("x".repeat(40_000)), /troppo lungo/);
  assert.throws(() => applyRemoteBarterMessageToStock(), /Trasferimento P2P bloccato/);
});

test("non prenota più risorse di quelle disponibili e non duplica le prenotazioni", () => {
  const l = ledger();
  const a = reserveLocalBarter(l, offer(), "proposer");
  assert.deepEqual(l.reservations, {});
  const retry = reserveLocalBarter(a, offer(), "proposer");
  assert.equal(retry, a);
  const b = makeBarterOffer({
    tradeId: "22222222222222222222222222222222", proposerId, responderId,
    gives: [{ resourceId: "wood", quantity: 60_000 }], wants: [{ resourceId: "iron", quantity: 1 }]
  });
  assert.throws(() => reserveLocalBarter(a, b, "proposer"), /insufficienti/);
  assert.throws(() => reserveLocalBarter(a, offer([{ resourceId: "wood", quantity: 1 }]), "proposer"), /già utilizzato/);
});

test("magazzino: capienza al termine del baratto e risorse carenti", () => {
  const bigReceive = offer([{ resourceId: "wood", quantity: 10 }], [{ resourceId: "iron", quantity: 90 }]);
  assert.throws(() => reserveLocalBarter(ledger({ wood: 50, iron: 30 }, 110), bigReceive, "proposer"), /Capienza/);
  assert.throws(() => reserveLocalBarter(ledger({ wood: 5, iron: 100 }, 200), bigReceive, "proposer"), /insufficienti/);
  const guestLedger = ledger({ wood: 3, iron: 18_000 }, 120_000);
  assert.throws(() => reserveLocalBarter(guestLedger, offer(), "responder"), /Capienza/);
});

test("cancel e replay: la release è idempotente e id del baratto resta consumato", () => {
  const deal = offer();
  const a = reserveLocalBarter(ledger(), deal, "proposer");
  const b = releaseLocalBarter(a, tradeId);
  assert.equal(b.reservations[tradeId].status, "released");
  assert.equal(releaseLocalBarter(b, tradeId), b);
  assert.throws(() => reserveLocalBarter(b, deal, "proposer"), /già utilizzato/);
  assert.equal(b.stock.wood, 150_000);
});

test("rifiuta overflow della somma, stock e capienza non validi", () => {
  const huge = offer([{ resourceId: "wood", quantity: 1 }], [{ resourceId: "iron", quantity: 3 }]);
  assert.throws(() => reserveLocalBarter(ledger({ wood: Number.MAX_SAFE_INTEGER, iron: 1 }, Number.MAX_SAFE_INTEGER), huge, "proposer"), /limiti numerici/);
  assert.throws(() => reserveLocalBarter(ledger({ wood: -1 }, 100), huge, "proposer"), /Scorta/);
  assert.throws(() => reserveLocalBarter(ledger({ wood: 100 }, 99), huge, "proposer"), /capienza/);
});
