import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { RELIGIONI_CON_CULTO } from "../src/game/luogoCulto.ts";
import { provaCreaReligioneCustom } from "../src/game/fedeleCulto.ts";
import { religioneTempioDi } from "../src/game/chiesa.ts";

test("il secondo culto canonico è il Culto delle Ombre", () => {
  assert.deepEqual([...RELIGIONI_CON_CULTO], ["Culto del Sole", "Culto delle Ombre"]);
});

test("le religioni personalizzate possono essere create e usate in una Chiesa", () => {
  const result = provaCreaReligioneCustom(
    { nome: "Ordine della Luna", emoji: "🌙", descrizione: "Culto lunare" },
    [],
    () => "rel-luna"
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(
    religioneTempioDi({ religioneTempio: result.religione.nome }, [result.religione]),
    "Ordine della Luna"
  );
});

test("Menu e route Religioni/Ombre/Chiesa restano presenti", () => {
  for (const path of [
    "app/religioni.tsx",
    "app/religione.tsx",
    "app/culto-ombre.tsx",
    "app/chiesa/[id].tsx"
  ]) {
    assert.equal(existsSync(resolve(process.cwd(), path)), true, path);
  }
  const menu = readFileSync(resolve(process.cwd(), "src/screens/GridGame.tsx"), "utf8");
  assert.equal(menu.includes('router.push("/religioni")'), true);
  assert.equal(menu.includes("🏰 Regno"), true);
});

test("i vecchi salvataggi contengono una migrazione Alieni → Ombre", () => {
  const validation = readFileSync(resolve(process.cwd(), "src/persistence/saveValidation.ts"), "utf8");
  assert.equal(validation.includes('"Culto degli Alieni"'), true);
  assert.equal(validation.includes('"Culto delle Ombre"'), true);
  assert.equal(validation.includes("normalizzaReligioniCustom"), true);
});
