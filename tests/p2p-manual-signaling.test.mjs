import assert from "node:assert/strict";
import test from "node:test";

import {
  SIGNAL_PREFIX,
  createManualSignal,
  parseManualSignal,
  makeHello,
  makeHeartbeat,
  encodeWire,
  parseWire
} from "../src/multiplayer/signalingProtocol.ts";
import { LanP2PSession } from "../src/multiplayer/lanSession.ts";

const idHost = "00000000000000000000000000000001";
const idGuest = "00000000000000000000000000000002";
const idSession = "00000000000000000000000000000003";
const fingerprint = new Array(32).fill("AA").join(":");
const sdp = [
  "v=0",
  "o=- 1 1 IN IP4 127.0.0.1",
  "s=-",
  "t=0 0",
  "a=ice-ufrag:test",
  "a=ice-pwd:abcdefghijklmnopqrstuv",
  "a=fingerprint:sha-256 " + fingerprint,
  "a=candidate:1 1 UDP 2122260223 192.168.1.5 4567 typ host",
  ""
].join("\r\n");
const now = 1_800_000_000_000;

test("codice manuale: invito e risposta round-trip, con ID condiviso", () => {
  const invitation = createManualSignal("offer", idSession, sdp, now);
  const reply = createManualSignal("answer", idSession, sdp, now + 1_000);
  assert.equal(parseManualSignal(invitation, "offer", undefined, now).sessionId, idSession);
  assert.equal(parseManualSignal(reply, "answer", idSession, now + 1_000).description.type, "answer");
  assert.ok(invitation.startsWith(SIGNAL_PREFIX));
  assert.throws(() => parseManualSignal(reply, "offer", undefined, now + 1_000), /invito/);
});

test("codice manuale: rifiuta risposte da altri collegamenti e codice scaduto", () => {
  const answer = createManualSignal("answer", idSession, sdp, now);
  assert.throws(() => parseManualSignal(answer, "answer", idHost, now), /altra connessione/);
  assert.throws(() => parseManualSignal(answer, "answer", idSession, now + 40 * 60_000), /scaduto/);
  assert.throws(() => parseManualSignal(answer, "answer", idSession, now - 10 * 60_000), /orologio/);
});

test("codice manuale: rifiuta SDP privi di fingerprint/ICE o codice troppo grande", () => {
  assert.throws(() => createManualSignal("offer", idSession, "v=0\r\ninvalid", now), /incompleta/);
  assert.throws(() => parseManualSignal("something", "offer", undefined, now), /non riconosciuto/);
  assert.throws(
    () => parseManualSignal(SIGNAL_PREFIX + "A".repeat(110_000), "offer", undefined, now),
    /non riconosciuto/
  );
});

test("wire: hello e ping hanno sessione vincolata, nessun trade ammesso", () => {
  const hello = makeHello(idSession, idHost);
  assert.deepEqual(parseWire(encodeWire(hello), idSession), hello);
  const ping = makeHeartbeat(idSession, 12);
  assert.equal(parseWire(encodeWire(ping), idSession).type, "ping");
  assert.equal(makeHeartbeat(idSession, 12, true).type, "pong");
  assert.throws(() => parseWire(encodeWire(hello), idGuest), /sessione/);
  assert.throws(
    () => parseWire(JSON.stringify({ protocol: "mk-p2p-v1", type: "trade", sessionId: idSession, iron: 999 }), idSession),
    /non autorizzata/
  );
  assert.throws(() => makeHeartbeat(idSession, -1), /Sequenza/);
});

class FakeChannel {
  readyState = "connecting";
  other = null;
  onopen = null;
  onclose = null;
  onmessage = null;

  send(data) {
    if (this.readyState !== "open") throw new Error("channel not open");
    this.other?.onmessage?.({ data });
  }
  open() {
    this.readyState = "open";
    this.onopen?.();
  }
  close() {
    this.readyState = "closed";
    this.onclose?.();
  }
}

function fakeFactory() {
  const peers = [];
  class FakePeer {
    iceGatheringState = "complete";
    localDescription = null;
    onicegatheringstatechange = null;
    ondatachannel = null;
    ownChannel = null;
    isClosed = false;
    constructor() { peers.push(this); }
    createDataChannel() {
      this.ownChannel = new FakeChannel();
      return this.ownChannel;
    }
    async createOffer() { return { type: "offer", sdp }; }
    async createAnswer() { return { type: "answer", sdp }; }
    async setLocalDescription(desc) { this.localDescription = desc; }
    async setRemoteDescription(desc) {
      if (desc.type === "offer") {
        this.ownChannel = new FakeChannel();
        this.ondatachannel?.({ channel: this.ownChannel });
        if (peers[0]?.ownChannel) {
          this.ownChannel.other = peers[0].ownChannel;
          peers[0].ownChannel.other = this.ownChannel;
        }
      } else if (desc.type === "answer") {
        // The answer is complete; both simulated data channels open.
        peers[1].ownChannel.open();
        peers[0].ownChannel.open();
      }
    }
    close() { this.isClosed = true; }
  }
  return { peers, createPeer: () => new FakePeer() };
}

test("connessione LAN simulata: invito, risposta, hello reciproci e ping/pong", async () => {
  const f = fakeFactory();
  const host = new LanP2PSession({ createPeer: f.createPeer, newId: (() => {
    const values = [idHost, idSession];
    return () => values.shift();
  })() });
  const guest = new LanP2PSession({ createPeer: f.createPeer, newId: () => idGuest });
  const offer = await host.host();
  const answer = await guest.join(offer);
  assert.equal(host.getSnapshot().state, "waiting");
  assert.equal(guest.getSnapshot().state, "waiting");
  await host.acceptAnswer(answer);
  assert.equal(host.getSnapshot().state, "connected");
  assert.equal(guest.getSnapshot().state, "connected");
  assert.equal(host.getSnapshot().otherPeerId, idGuest);
  assert.equal(guest.getSnapshot().otherPeerId, idHost);
  host.ping(7);
  assert.equal(host.getSnapshot().lastPong, 7);
  host.close();
  guest.close();
  assert.equal(f.peers[0].isClosed, true);
  assert.equal(f.peers[1].isClosed, true);
});

test("connessione LAN simulata: non permette doppia sessione e rifiuta answer sbagliate", async () => {
  const f = fakeFactory();
  const host = new LanP2PSession({ createPeer: f.createPeer, newId: (() => {
    const ids = [idHost, idSession]; return () => ids.shift();
  })() });
  await host.host();
  await assert.rejects(() => host.host(), /precedente/);
  const wrong = createManualSignal("answer", idGuest, sdp);
  await assert.rejects(() => host.acceptAnswer(wrong), /altra connessione/);
  assert.equal(host.getSnapshot().state, "waiting");
  host.close();
  assert.throws(() => host.ping(0), /non è ancora operativo/);
});
