import assert from "node:assert/strict";
import test from "node:test";

import {
  sincronizzaCuginoNobileConRe,
  trovaCuginoNobileDelRe
} from "../src/game/cuginoNobileAvventura.ts";
import { generaColoniaIniziale } from "../src/game/generazionePartita.ts";
import { ID_ZIO_PATERNO_DECEDUTO_RE } from "../src/game/reGenitoriDeceduti.ts";

test("Avventura aggiunge un cugino Nobile con 2 Schiavi privati", () => {
  for (let i = 0; i < 20; i += 1) {
    const { abitanti } = generaColoniaIniziale("avventura");
    const cugino = trovaCuginoNobileDelRe(abitanti);

    assert.ok(cugino);
    assert.equal(cugino.casta, "Nobile");
    assert.deepEqual(cugino.genitoriIds, [ID_ZIO_PATERNO_DECEDUTO_RE]);

    const schiavi = abitanti.filter(
      (a) =>
        a.casta === "Schiavo" &&
        a.ruoloSchiavitu === "schiavo" &&
        a.schiavistaId === cugino.id
    );

    assert.equal(schiavi.length, 2);
    for (const schiavo of schiavi) {
      assert.ok(schiavo.fazioni.includes("Schiavi"));
      assert.equal(schiavo.fazioni.includes("Cittadini"), false);
    }

    assert.equal(new Set(abitanti.map((a) => a.id)).size, abitanti.length);
  }
});

test("Creativa non aggiunge il cugino Nobile di Avventura", () => {
  const { abitanti } = generaColoniaIniziale("creativa");
  assert.equal(trovaCuginoNobileDelRe(abitanti), undefined);
});

test("dopo la creazione del Re il cognome del cugino segue il ramo paterno", () => {
  const generated = generaColoniaIniziale("avventura");
  const conNomeRe = generated.abitanti.map((a) =>
    a.id === 1 ? { ...a, nome: "Mario Verdi" } : a
  );

  const synced = sincronizzaCuginoNobileConRe(conNomeRe);
  const cugino = trovaCuginoNobileDelRe(synced);

  assert.ok(cugino);
  assert.ok(cugino.nome.endsWith(" Verdi"));
  assert.deepEqual(cugino.genitoriIds, [ID_ZIO_PATERNO_DECEDUTO_RE]);
});
