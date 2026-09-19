import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("lo stato degli obiettivi completati viene salvato e ripristinato", () => {
  const saveTypes = readFileSync("src/persistence/saveTypes.ts", "utf8");
  const mapping = readFileSync("src/persistence/gameStateMapping.ts", "utf8");
  const hook = readFileSync("src/hooks/useGameState.ts", "utf8");
  const context = readFileSync("src/context/GameContext.tsx", "utf8");

  assert.match(saveTypes, /obiettiviCompletati\?: string\[\]/);
  assert.match(mapping, /obiettiviCompletati: state\.obiettiviCompletati/);
  assert.match(mapping, /obiettiviCompletati: normalized\.events\.obiettiviCompletati \?\? \[\]/);
  assert.match(hook, /const \[obiettiviCompletati, setObiettiviCompletati\] = useState<string\[\]>\(\[\]\)/);
  assert.match(hook, /setObiettiviCompletati\(state\.obiettiviCompletati \?\? \[\]\)/);
  assert.match(context, /obiettiviCompletati: string\[\]/);
});
