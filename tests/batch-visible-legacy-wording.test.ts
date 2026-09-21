import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("le schermate aggiornate non espongono terminologia legacy sci-fi/colonia", () => {
  for (const path of [
    "app/impianto-riciclo.tsx",
    "app/legge-razziale.tsx",
    "app/mafia.tsx",
    "app/pena-di-morte.tsx",
    "app/ospedale.tsx",
    "app/personalita.tsx",
    "app/rifiuti.tsx",
    "app/porto.tsx",
    "app/religione.tsx",
    "src/ui/ReligionePieChart.tsx",
    "src/ui/ReligioneFedeliModal.tsx",
    "app/culto-ombre.tsx"
  ]) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /Culto degli Alieni|\/culto-alieni|\/pianeti|a\.specie|👽/i);
  }

  assert.doesNotMatch(readFileSync("app/impianto-riciclo.tsx", "utf8"), /colonia/i);
  assert.doesNotMatch(readFileSync("app/legge-razziale.tsx", "utf8"), /colonia/i);
  assert.doesNotMatch(readFileSync("app/mafia.tsx", "utf8"), /colonia/i);
  assert.doesNotMatch(readFileSync("app/pena-di-morte.tsx", "utf8"), /colonia/i);
  assert.doesNotMatch(readFileSync("app/ospedale.tsx", "utf8"), /colonia/i);
  assert.doesNotMatch(readFileSync("app/personalita.tsx", "utf8"), /colonia/i);
  assert.doesNotMatch(readFileSync("app/rifiuti.tsx", "utf8"), /colonia/i);

  const religione = readFileSync("app/religione.tsx", "utf8");
  assert.match(religione, /Culto delle Ombre/);
  assert.match(religione, /\/culto-ombre/);
  assert.match(religione, /🌑/);

  const porto = readFileSync("app/porto.tsx", "utf8");
  assert.match(porto, /router\.push\("\/regni"\)/);
});
