import assert from "node:assert/strict";
import test from "node:test";

import { generaColoniaIniziale } from "../src/game/generazionePartita.ts";

test("Avventura ripristina Consigliere, Edile e Minatori iniziali", () => {
  for (let i = 0; i < 30; i += 1) {
    const { abitanti } = generaColoniaIniziale("avventura");

    const consiglieri = abitanti.filter((a) => a.lavoro === "Consigliere");
    const edili = abitanti.filter((a) => a.lavoro === "Edile");
    const minatori = abitanti.filter((a) => a.lavoro === "Minatore");
    const monetieri = abitanti.filter((a) => a.lavoro === "Monetiere");

    assert.equal(consiglieri.length, 1);
    assert.equal(consiglieri[0]?.eta, 60);
    assert.equal(consiglieri[0]?.sesso, "M");
    assert.equal(consiglieri[0]?.razza, "Umano");
    assert.ok(consiglieri[0]?.fazioni?.includes("Rivoluzionari"));

    assert.equal(edili.length, 1);
    assert.equal(minatori.length, 2);

    // Il Monetiere viene assegnato solo se resta un candidato dopo Re,
    // Consigliere, tutti gli Agricoltori, Edile e 2 Minatori.
    // Gli Agricoltori casuali aggiuntivi possono quindi occupare gli ultimi posti disponibili.
    assert.ok(monetieri.length <= 1);

    const ruoli = new Set(
      abitanti
        .filter((a) =>
          ["Consigliere", "Agricoltore", "Edile", "Minatore", "Monetiere"].includes(a.lavoro)
        )
        .map((a) => a.id)
    );
    assert.equal(
      ruoli.size,
      1 +
        abitanti.filter((a) => a.lavoro === "Agricoltore").length +
        edili.length +
        minatori.length +
        monetieri.length
    );
  }
});
