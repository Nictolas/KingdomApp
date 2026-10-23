import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("app/mappa.tsx", "utf8");

test("HUD mobile: Menu e Diario rimangono nella barra superiore e le statistiche non la sovraccaricano", () => {
  const header = source.slice(source.indexOf("Header mobile su righe distinte"),source.indexOf("{modalitaDemolisci ? ("));
  assert.match(header,/router\.push\("\/menu"\)/);
  assert.match(header,/router\.push\("\/diario"\)/);
  assert.match(header,/soddisfazioneMediaRegno/);
  assert.match(header,/topPrimaryRow/);
  assert.match(header,/topSecondaryRow/);
  assert.doesNotMatch(header,/router\.push\("\/(felicita|lealta|paura)"\)/);
});

test("HUD mobile: Costruisci, Richieste, Eventi sempre fuori dallo scorrimento risorse", () => {
  const footer = source.slice(source.indexOf("{/* Menu fisso in basso:"),source.indexOf("<RichiesteModal"));
  assert.match(footer,/<\/ScrollView>[\s\S]*\)\}[\s\S]*bottomActionsRow/);
  assert.match(footer,/Costruisci/);
  assert.match(footer,/Richieste/);
  assert.match(footer,/Eventi/);
  assert.doesNotMatch(footer,/setMostraGrigliaMappa\(\(v\) => !v\)/);
});

test("HUD mobile: Demolisci si trova nella finestra Costruisci, non sulla barra fissa", () => {
  const footer = source.slice(source.indexOf("{/* Menu fisso in basso:"),source.indexOf("<RichiesteModal"));
  assert.doesNotMatch(footer,/onPress=\{onDemolisciPress\}/);
  const modal = source.slice(source.indexOf('visible={mostraModalCostruisci}'),source.indexOf('</Modal>',source.indexOf('visible={mostraModalCostruisci}')));
  assert.match(modal,/onPress=\{onDemolisciPress\}/);
  assert.match(modal,/>Demolisci</);
});

test("HUD mobile: barra più alta, pulsanti visibili anche selezionando un abitante", () => {
  assert.match(source,/bottomBarInnerResident:\s*\{\s*height:\s*230/);
  assert.match(source,/height:\s*Platform\.OS === "web" \? 150 : 128/);
  assert.match(source,/paddingBottom:\s*Platform\.OS === "web" \? 26 : 10/);
  const footer = source.slice(source.indexOf("{/* Menu fisso in basso:"),source.indexOf("<RichiesteModal"));
  assert.match(footer,/\{sintesiMappaAbitante \? \(/);
  assert.match(footer,/\)\}\s*<View style=\{styles\.bottomActionsRow\}>/);
});
