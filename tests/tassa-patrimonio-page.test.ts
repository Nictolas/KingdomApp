import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("ripristina Tassa sul Patrimonio con stato, salvataggio e applicazione mensile", () => {
  const pagina = readFileSync("app/tassa-patrimonio.tsx", "utf8");
  const leggi = readFileSync("app/leggi.tsx", "utf8");
  const hook = readFileSync("src/hooks/useGameState.ts", "utf8");
  const mapping = readFileSync("src/persistence/gameStateMapping.ts", "utf8");
  const tasse = readFileSync("src/game/tasse.ts", "utf8");

  assert.match(pagina, /GateTassaSbloccata/);
  assert.match(pagina, /tassaId="patrimonio"/);
  assert.match(pagina, /setTassaPatrimonioPercentuale/);
  assert.match(pagina, /calcolaTassaPatrimonioImporto/);
  assert.match(leggi, /\/tassa-patrimonio/);

  assert.match(hook, /tassaPatrimonioPercentuale/);
  assert.match(hook, /applicaTasseMensili/);
  assert.match(hook, /tasseUnlock\.has\("patrimonio"\)/);
  assert.match(mapping, /tassaPatrimonioPercentuale/);
  assert.match(tasse, /calcolaTassaPatrimonioImporto/);
  assert.match(tasse, /gettitoPatrimonio/);
});
