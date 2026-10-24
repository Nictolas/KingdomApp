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
