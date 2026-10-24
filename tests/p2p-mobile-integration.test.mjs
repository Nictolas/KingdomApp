import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("La lobby P2P è collegata al Mercato soltanto sui telefoni", () => {
  const market = read("app/mercato.tsx");
  assert.match(market, /Platform\.OS !== "web"/);
  assert.match(market, /router\.push\("\/multiplayer"\)/);
  const view = read("app/multiplayer.tsx");
  assert.match(view, /createNativeLanSession/);
  assert.match(view, /session\.host\(\)/);
  assert.match(view, /session\.join\(incoming\)/);
  assert.match(view, /session\.acceptAnswer\(incoming\)/);
  assert.match(view, /Share\.share/);
  assert.match(view, /sessionRef\.current\?\.ping/);
  assert.match(view, /Non sono richiesti account, database o server/);
});

test("Il bridge WebRTC è nativo e genera identificativi con RNG crittografico", () => {
  const native = read("src/multiplayer/nativeTransport.native.ts");
  const web = read("src/multiplayer/nativeTransport.web.ts");
  assert.match(native, /Crypto\.getRandomBytes\(16\)/);
  assert.match(native, /iceServers: \[\]/);
  assert.match(native, /require\("react-native-webrtc"\)/);
  assert.match(web, /Android o iPhone/);
  assert.doesNotMatch(native, /Math\.random/);
});

test("I permessi restano limitati al networking: no audio/video/overlay", () => {
  const config = JSON.parse(read("app.json")).expo;
  assert.equal(typeof config.ios.infoPlist.NSLocalNetworkUsageDescription, "string");
  assert.ok(config.android.permissions.includes("android.permission.INTERNET"));
  for (const forbidden of ["CAMERA", "RECORD_AUDIO", "SYSTEM_ALERT_WINDOW"]) {
    assert.ok(config.android.blockedPermissions.includes("android.permission." + forbidden));
  }
  const plugins = JSON.stringify(config.plugins);
  assert.doesNotMatch(plugins, /react-native-webrtc/);
});

test("La lobby non abilita il commercio prima dell'accordo P2P", () => {
  const view = read("app/multiplayer.tsx");
  assert.match(view, /Lo scambio di merci non è ancora attivo/);
  assert.doesNotMatch(view, /addResources|transferStock|commitTrade|setInventario|setRisorse/);
});

test("La negoziazione del baratto è visibile ma NON modifica scorte", () => {
  const ui = read("app/multiplayer.tsx");
  const transport = read("src/multiplayer/nativeTransport.native.ts");
  assert.match(ui, /session\.proposeBarterDurably/);
  assert.match(ui, /session\.respondToBarter/);
  assert.match(ui, /Le merci NON vengono ancora trasferite/);
  assert.match(ui, /useGameContext/);
  assert.match(transport, /onBarterMessage/);
  assert.doesNotMatch(ui, /setRisorse|setInventario|commitTrade|transferStock/);
});

test("Persistenza delle proposte prima dell'invio, solo su partita salvata", () => {
  const ui = read("app/multiplayer.tsx");
  const nativeJournal = read("src/multiplayer/createProtectedBarterJournal.native.ts");
  const webJournal = read("src/multiplayer/createProtectedBarterJournal.web.ts");
  const context = read("src/context/GameContext.tsx");
  const session = read("src/multiplayer/lanSession.ts");
  assert.match(context, /activeSaveId: metadataRef\.current\?\.saveId/);
  assert.match(ui, /journal\.propose\(offer, "proposer"\)/);
  assert.match(ui, /await journal\.decide\(receivedTrade\.tradeId, accepted\)/);
  assert.match(ui, /proposeBarterDurably/);
  assert.match(session, /await persist\(offer\);[\s\S]*this\.transmitOffer\(offer\);/);
  assert.match(nativeJournal, /createGameSaveStorage/);
  assert.match(webJournal, /throw new Error/);
});
