import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Assimilazione ed Eventi usano il layer fantasy aggiornato", () => {
  const assimilazione = readFileSync("src/game/assimilazione.ts", "utf8");
  assert.match(assimilazione, /generaNomeFantasy/);
  assert.doesNotMatch(assimilazione, /nomiAlieni|generaNomeAlieno|specie:\s*"alieno"/);

  for (const path of [
    "src/game/eventi/eventoTypes.ts",
    "src/game/eventi/assimilazione.ts",
    "src/game/eventi/emigrazione.ts",
    "src/game/eventi/guerraCivile.ts",
    "src/game/eventi/protesteAutoctoni.ts",
    "src/game/eventi/rivoluzionariDelusi.ts",
    "src/game/eventiDisponibili.ts"
  ]) {
    const source = readFileSync(path, "utf8");
    assert.doesNotMatch(source, /colonia|pianeta|Ex Governatore|Skip Mese/i);
  }

  const luogoCulto = readFileSync("src/game/luogoCulto.ts", "utf8");
  const eventi = readFileSync("src/game/eventiDisponibili.ts", "utf8");
  assert.match(luogoCulto, /ombre\?: number \| null/);
  assert.match(eventi, /ombre: capoReligiosoOmbre/);
});
