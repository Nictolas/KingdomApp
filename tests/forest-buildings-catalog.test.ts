import assert from "node:assert/strict";
import test from "node:test";
import { edificiData } from "../src/data/edificiData";
import { EDIFICIO_TO_LAVORO, getLavoroPerEdificio } from "../src/game/edificiLavoro";
import { costoCostruzioneMonete } from "../src/game/edificiPrezzi";
import { filtraEdificiInizialiPerModalita } from "../src/game/edificiInizialiModalita";
import { FOOTPRINT_COSTRUZIONE } from "../src/game/mappaCostruzioneFootprints";
import { SEZIONI_COSTRUZIONE } from "../src/game/costruzioneSezioni";
import { orarioPerLavoro } from "../src/game/orariLavoroCatalogo";
import { SEDE_PER_PROFESSIONE } from "../src/game/turniForestali";
import type { Edificio } from "../src/types";

test("Le sei sedi sono costruibili, hanno costo, posti e orario; non sono gratis all'inizio", () => {
  const tutti = Object.entries(SEDE_PER_PROFESSIONE).filter(([,s]) => s !== null);
  const sezione = SEZIONI_COSTRUZIONE.find((s) => s.titolo === "Foresta");
  assert.ok(sezione);
  assert.equal(tutti.length, 6);
  for (const [lavoro, nome] of tutti) {
    const template = edificiData.find((e) => e.nome === nome);
    assert.ok(template, nome!);
    assert.equal(getLavoroPerEdificio(template), lavoro);
    assert.ok(EDIFICIO_TO_LAVORO[template.id]);
    assert.ok((template.capacità ?? 0) >= 1);
    assert.ok(costoCostruzioneMonete(nome!) > 0);
    assert.ok(orarioPerLavoro(lavoro));
    assert.deepEqual(FOOTPRINT_COSTRUZIONE[nome!], { w: 1, h: 1 });
    assert.ok(sezione!.nomi.includes(nome!));
    for (const mode of ["creativa", "avventura"] as const) {
      assert.ok(!filtraEdificiInizialiPerModalita(edificiData, mode).some(e => e.nome === nome));
    }
  }
  assert.equal(SEDE_PER_PROFESSIONE.Raccoglitore, null);
});

test("Un id dinamico pari all'id del template NON cambia il lavoro di una casa", () => {
  const capannaCostruita = { id: 54, nome: "Capanna", stato: "Operativo" } as Edificio;
  assert.equal(getLavoroPerEdificio(capannaCostruita), undefined);
  const sedeCacciaConIdDinamico = { ...edificiData.find(e => e.nome === "Capanna del Cacciatore")!, id: 150 };
  assert.equal(getLavoroPerEdificio(sedeCacciaConIdDinamico), "Cacciatore");
});
