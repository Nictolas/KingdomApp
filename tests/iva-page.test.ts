import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("ripristina IVA con pagina, stato, salvataggio e applicazione mensile", () => {
  const pagina = readFileSync("app/imposta-valore-aggiunto.tsx", "utf8");
  const leggi = readFileSync("app/leggi.tsx", "utf8");
  const hook = readFileSync("src/hooks/useGameState.ts", "utf8");
  const mapping = readFileSync("src/persistence/gameStateMapping.ts", "utf8");
  const tasse = readFileSync("src/game/tasse.ts", "utf8");

  assert.match(pagina, /GateTassaSbloccata/);
  assert.match(pagina, /tassaId="iva"/);
  assert.match(pagina, /setIvaPercentuale/);
  assert.match(pagina, /calcolaIvaImporto/);
  assert.match(leggi, /\/imposta-valore-aggiunto/);

  assert.match(hook, /ivaPercentuale/);
  assert.match(hook, /tasseUnlock\.has\("iva"\)/);
  assert.match(hook, /gettitoIva/);
  assert.match(mapping, /ivaPercentuale/);
  assert.match(tasse, /calcolaIvaImporto/);
  assert.match(tasse, /gettitoIva/);
});
