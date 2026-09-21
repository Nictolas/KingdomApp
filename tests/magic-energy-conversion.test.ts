import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { risorseData, estraiCreditiLegacyDaRisorse } from "../src/data/risorseData";
import { calcolaProduzioneConsumoPuro } from "../src/game/produzioneConsumo";
import { EVENTI_CATALOGO } from "../src/game/eventi";
import { edificiData } from "../src/data/edificiData";

test("Energia Magica sostituisce la vecchia Energia elettrica", () => {
  const energia = risorseData.find((r) => r.id === 4);
  assert.deepEqual(energia, {
    id: 4,
    nome: "Energia Magica",
    quantità: 68,
    unità: "mana"
  });
  assert.equal(risorseData.some((r) => r.nome === "Energia"), false);
});

test("i vecchi save migrano Energia in Energia Magica mantenendo la quantità", () => {
  const legacy = estraiCreditiLegacyDaRisorse([
    { id: 4, nome: "Energia", quantità: 41, unità: "MW" },
    { id: 2, nome: "Cibo", quantità: 10, unità: "razioni" }
  ]);

  assert.equal(legacy.creditiLegacy, 0);
  assert.deepEqual(legacy.risorse[0], {
    id: 4,
    nome: "Energia Magica",
    quantità: 41,
    unità: "mana"
  });
});

test("i Golem consumano 2 mana al mese e le residenze non consumano Energia Magica", () => {
  const variazioni = calcolaProduzioneConsumoPuro({
    abitanti: [{ id: 1, razza: "Golem" } as any],
    edifici: [
      {
        id: 14,
        nome: "Dormitorio",
        tipo: "Residenza",
        stato: "Operativo",
        abitantiAssegnati: [1],
        occupazione: 1,
        capacità: 10,
        efficienza: 100
      } as any
    ],
    risorse: [{ id: 4, nome: "Energia Magica", quantità: 68, unità: "mana" }]
  });

  assert.equal(variazioni["Energia Magica"], -2);
});

test("Tempesta Arcana sostituisce Tempesta Solare", () => {
  const evento = EVENTI_CATALOGO.find((e) => e.id === "tempesta-arcana");
  assert.ok(evento);
  assert.equal(evento.nome, "Tempesta Arcana");
  assert.equal(EVENTI_CATALOGO.some((e) => e.id === "tempesta-solare"), false);

  const risorse = [{ id: 4, nome: "Energia Magica", quantità: 50, unità: "mana" }];
  evento.applicaAttivazione(risorse as any, [], []);
  assert.equal(risorse[0]!.quantità, 20);

  assert.equal(existsSync("src/game/eventi/tempestaSolare.ts"), false);
  assert.equal(existsSync("src/game/eventi/tempestaArcana.ts"), true);
});

test("gli edifici arcani producono e consumano Energia Magica", () => {
  const laboratorio = edificiData.find((e) => e.nome === "Laboratorio Magico");
  const cripta = edificiData.find((e) => e.nome === "Cripta Necromantica");

  assert.match(laboratorio?.produzione ?? "", /Energia Magica/);
  assert.match(cripta?.consumo ?? "", /Energia Magica/);
});

test("le residenze non conservano consumi elettrici in MW", () => {
  const catalogo = readFileSync(
    new URL("../src/data/residenzeData.ts", import.meta.url),
    "utf8"
  );
  const schermata = readFileSync(
    new URL("../app/residenze.tsx", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(catalogo, /energiaPerAbitante|\bMW\b/);
  assert.doesNotMatch(schermata, /energiaPerAbitante|\bMW\b|Energia richiesta|Energia consumata/);
});
