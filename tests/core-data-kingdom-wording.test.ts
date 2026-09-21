import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("dati core e produzione usano terminologia fantasy del Regno", () => {
  const ministri = readFileSync("src/data/ministriData.ts", "utf8");
  const abitanti = readFileSync("src/data/abitantiData.ts", "utf8");
  const produzione = readFileSync("src/game/produzioneConsumo.ts", "utf8");
  const pubblici = readFileSync("src/game/edificiPubblici.ts", "utf8");

  assert.match(ministri, /Finanze del Regno/);
  assert.doesNotMatch(ministri, /Finanze Coloniali/);

  assert.match(abitanti, /Culto delle Ombre/);
  assert.doesNotMatch(abitanti, /Culto degli Alieni/);

  assert.doesNotMatch(produzione, /\bRobot\b|Robots|numRobots/);
  assert.match(produzione, /numGolem/);

  assert.doesNotMatch(pubblici, /Skip Mese|cassa colonia/i);
  assert.match(pubblici, /cassa del regno/i);
});
