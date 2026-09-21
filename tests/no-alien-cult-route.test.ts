import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

test("il vecchio Culto degli Alieni non è più una route canonica", () => {
  assert.equal(existsSync("app/culto-alieni.tsx"), false);

  const files = [
    "src/game/fedeleCulto.ts",
    "src/game/generazionePartita.ts",
    "src/game/immigrazione.ts",
    "src/game/presenzaLuogoCulto.ts",
    "src/data/fazioniData.ts",
    "app/fazioni.tsx"
  ];

  for (const path of files) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /Culto degli Alieni|\/culto-alieni/);
    assert.match(source, /Culto delle Ombre|culto-ombre/);
  }
});
