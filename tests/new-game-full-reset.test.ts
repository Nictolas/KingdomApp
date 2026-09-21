import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("Nuova Partita resetta tutti gli stati React persistenti del gioco", () => {
  const source = readRepoFile("src/hooks/useGameState.ts");
  const start = source.indexOf("const startNewGame = useCallback");
  const end = source.indexOf("const configuraGiocatore", start);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const startNewGame = source.slice(start, end);
  const setters = [
    ...source.matchAll(
      /const\s*\[\s*[A-Za-zÀ-ÿ0-9_]+\s*,\s*(set[A-Za-zÀ-ÿ0-9_]+)\s*\]\s*=\s*useState/g
    )
  ].map((match) => match[1]);

  const missing = setters.filter((setter) => !startNewGame.includes(`${setter}(`));
  assert.deepEqual(missing, []);
});

test("Nuova Partita resetta anche mappa, inventari e code runtime", () => {
  const source = readRepoFile("src/hooks/useGameState.ts");
  const start = source.indexOf("const startNewGame = useCallback");
  const end = source.indexOf("const configuraGiocatore", start);
  const startNewGame = source.slice(start, end);

  for (const marker of [
    "setMappaSessione(null)",
    "setInventarioGiocatore(",
    "setInventarioMensaByEdificioId({})",
    "setInventarioEmporioByEdificioId(",
    "setOrdiniMercato([])",
    "setEventiInCorso([])",
    "setRichiesteInAttesa([])",
    "setReligioniCustom([])",
    "setPrezzoResidenzeState({})"
  ]) {
    assert.ok(startNewGame.includes(marker), `Reset mancante: ${marker}`);
  }
});
