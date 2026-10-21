import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("Capanna condivide la schermata piena e conserva le informazioni di presenza", () => {
  const source = read("src/ui/CapannaFullscreenModal.tsx");
  assert.match(source, /<BuildingScreenShell title="Capanna" onBack=\{onClose\}/);
  assert.match(source, /presentationStyle="fullScreen"/);
  assert.match(source, /statoPresenzaOccupanteCapanna/);
  assert.match(source, /badgePresenzaCapanna/);
  assert.doesNotMatch(source, /<ScrollView/);
});

test("Bar condivide la shell, mobile a colonna singola e desktop a due colonne", () => {
  const source = read("app/bar/[id].tsx");
  assert.match(source, /<BuildingScreenShell/);
  assert.match(source, /styles\.dueColonneWide/);
  assert.match(source, /dueColonne:\s*\{\s*flexDirection: "column"/);
  assert.match(source, /onPress=\{\(\) => rimuoviAbitanteDaEdificio\(a\.id, bar\.id\)\}/);
  assert.match(source, /assegnaServoDellaGlebaAEdificio\(a\.id, bar\.id\)/);
  assert.equal((source.match(/<ScrollView/g) ?? []).length, 1, "uno scroll nel solo selettore addetti");
});

test("Mensa condivide shell e preserva trasferimenti, addetti e selettore", () => {
  const source = read("app/mensa/[id].tsx");
  assert.match(source, /<BuildingScreenShell/);
  assert.match(source, /trasferisciCiboGiocatoreAMensa\(edificioId, itemId, quantità\)/);
  assert.match(source, /assegnaAbitanteAEdificio\(a\.id, edificioId\)/);
  assert.match(source, /rimuoviAbitanteDaEdificio\(a\.id, edificioId\)/);
  assert.equal((source.match(/<ScrollView/g) ?? []).length, 1, "uno scroll nel solo selettore addetti");
});
