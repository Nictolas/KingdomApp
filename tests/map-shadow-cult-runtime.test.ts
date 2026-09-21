import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Mappa ed Eventi UI usano lo stato runtime fantasy aggiornato", () => {
  const mappa = readFileSync("app/mappa.tsx", "utf8");
  const eventi = readFileSync("src/game/eventiDisponibili.ts", "utf8");

  assert.match(mappa, /capoReligiosoOmbre/);
  assert.match(mappa, /\/culto-ombre/);
  assert.doesNotMatch(mappa, /capoReligiosoAlieni|\/culto-alieni/);

  assert.match(eventi, /matrimonioConGolem/);
  assert.match(eventi, /capoReligiosoOmbre/);
  assert.match(eventi, /Culto delle Ombre/);
  assert.doesNotMatch(eventi, /matrimonioUmanoRobot|capoReligiosoAlieni|Culto degli Alieni/);
});
