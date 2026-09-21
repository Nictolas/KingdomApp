import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("le schermate di sistema usano terminologia Regno e tempi correnti", () => {
  for (const path of [
    "app/sanita.tsx",
    "app/sanzioni.tsx",
    "src/game/eventi/minacceGeopolitiche.ts",
    "app/scuola.tsx",
    "app/sicurezza.tsx",
    "app/tassa-reddito.tsx",
    "app/ufficio-edile.tsx",
    "app/schiavitu.tsx"
  ]) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /colonia|Comunità Interplanetaria|altre colonie|Skip Mese/i);
  }

  assert.match(readFileSync("app/sanzioni.tsx", "utf8"), /potenze straniere/);
  assert.match(readFileSync("src/game/eventi/minacceGeopolitiche.ts", "utf8"), /altri regni/);
  assert.match(readFileSync("app/ufficio-edile.tsx", "utf8"), /ogni ora di gioco/);
  assert.match(readFileSync("app/schiavitu.tsx", "utf8"), /proprietà della Corona/);
});
