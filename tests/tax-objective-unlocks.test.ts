import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { tasseSbloccate } from "../src/game/tasseSblocco";

test("la progressione fiscale segue gli obiettivi in Avventura", () => {
  assert.deepEqual([...tasseSbloccate([], "avventura")], ["prelievo"]);

  const patrimonio = tasseSbloccate(["cancelleria_fiscale"], "avventura");
  assert.equal(patrimonio.has("patrimonio"), true);
  assert.equal(patrimonio.has("reddito"), false);
  assert.equal(patrimonio.has("iva"), false);

  const reddito = tasseSbloccate(["cancelleria_fiscale", "riforma_reddito"], "avventura");
  assert.equal(reddito.has("reddito"), true);
  assert.equal(reddito.has("iva"), false);

  const iva = tasseSbloccate(
    ["cancelleria_fiscale", "riforma_reddito", "riforma_iva"],
    "avventura"
  );
  assert.equal(iva.has("iva"), true);
});

test("in Creativa tutte le tasse sono disponibili", () => {
  const tasse = tasseSbloccate([], "creativa");
  for (const id of ["prelievo", "patrimonio", "reddito", "iva"]) {
    assert.equal(tasse.has(id as any), true);
  }
});

test("Leggi mostra i blocchi fiscali e Tassa sul Reddito usa il gate", () => {
  const leggi = readFileSync("app/leggi.tsx", "utf8");
  const reddito = readFileSync("app/tassa-reddito.tsx", "utf8");
  const catalogo = readFileSync("src/data/leggiData.ts", "utf8");

  assert.match(leggi, /tasseSbloccate/);
  assert.match(leggi, /tassaBloccata/);
  assert.match(reddito, /GateTassaSbloccata/);
  assert.match(reddito, /tassaId="reddito"/);
  assert.match(catalogo, /Imposta sul Valore Aggiunto/);
  assert.doesNotMatch(catalogo, /Tassa sulla Produzione/);
});
