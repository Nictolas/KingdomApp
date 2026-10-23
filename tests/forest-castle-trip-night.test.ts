import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { preservaViaggiUdienzaDuranteCambioGiorno } from "../src/game/preservaViaggioUdienza";

const richiesta = (stato: "verso_castello" | "pronta" | "chiusa") => ({
  id: "udienza-bosco-1-7", eventoId: "bosco-1-7",
  abitanteId: 7, stato, dannoMonete: 4
});
const persone = [{
  id: 7, salute: 90, richiestaRapinaBosco: richiesta("verso_castello")
}, { id: 8, salute: 100 }];

test("Notte/alba non spostano a casa una vittima che cammina verso il Castello", () => {
  const trip = { purpose: "udienza_banditi", path: [12, 13, 14, 15], token: 1234 };
  const result = preservaViaggiUdienzaDuranteCambioGiorno(
    { 7: trip }, {
      7: { purpose: "home", path: [12, 22], token: 4321 },
      8: { purpose: "home", path: [19, 29], token: 4321 }
    }, persone
  );
  assert.equal(result[7], trip);
  assert.equal(result[8]!.purpose, "home");
});

test("Non conserva viaggi conclusi, vittime decedute né vecchie commute", () => {
  const trip = { purpose: "udienza_banditi", path: [2, 3], token: 1234 };
  const base = { 7: trip };
  assert.deepEqual(preservaViaggiUdienzaDuranteCambioGiorno(
    base, {}, [{ ...persone[0]!, richiestaRapinaBosco: richiesta("pronta") }]
  ), {});
  assert.deepEqual(preservaViaggiUdienzaDuranteCambioGiorno(
    base, {}, [{ ...persone[0]!, salute: 0 }]
  ), {});
  assert.deepEqual(preservaViaggiUdienzaDuranteCambioGiorno(
    { 7: { ...trip, purpose: "work" } }, {}, persone
  ), {});
});

test("La mappa usa il preservatore sia al mattino sia alla sera", () => {
  const src = readFileSync("app/mappa.tsx", "utf8");
  const count = (src.match(/preservaViaggiUdienzaDuranteCambioGiorno\(prev, next, abitanti\)/g) ?? []).length;
  assert.equal(count, 2);
  assert.match(src, /portaCastello/);
  assert.match(src, /cellaArrivo === portaCastello/);
});
