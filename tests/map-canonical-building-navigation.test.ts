import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { tornaAllaMappa } from "../src/navigation/tornaAllaMappa.ts";

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Avventura e Creativa: niente redirect circolare fra / e /mappa", () => {
  const root = source("app/index.tsx");
  const map = source("app/mappa.tsx");
  assert.match(root, /return <MappaScreen\s*\/>/);
  assert.doesNotMatch(root, /<Redirect\s+href=/);
  assert.match(map, /export default function MappaRoute\(\)\s*\{\s*return <Redirect href="\/"\s*\/>/);
});

test("dopo Bar/Serra/Mensa/Castello torna alla mappa montata, senza navigate che duplica Phaser", () => {
  const actions: string[] = [];
  const router = {
    canGoBack: () => true,
    back: () => { actions.push("back"); },
    replace: (href: string) => { actions.push(`replace:${href}`); }
  };
  tornaAllaMappa(router as Parameters<typeof tornaAllaMappa>[0]);
  tornaAllaMappa(router as Parameters<typeof tornaAllaMappa>[0]);
  assert.deepEqual(actions, ["back", "back"]);
  const nav = source("src/navigation/tornaAllaMappa.ts");
  assert.doesNotMatch(nav, /router\.navigate\(/);

  for (const path of [
    "app/bar/[id].tsx",
    "app/mensa/[id].tsx",
    "app/serra/[id].tsx",
    "app/castello.tsx"
  ]) {
    assert.match(source(path), /tornaAllaMappa\(router\)/, path);
  }
});

test("visita diretta a una scheda edificio senza stack torna alla home vera", () => {
  const calls: string[] = [];
  const router = {
    canGoBack: () => false,
    back: () => calls.push("back"),
    replace: (href: string) => calls.push(`replace:${href}`)
  };
  tornaAllaMappa(router as Parameters<typeof tornaAllaMappa>[0]);
  assert.deepEqual(calls, ["replace:/"]);
});

test("mappa riattiva input e loop Phaser dopo il ripristino del focus", () => {
  const mappa = source("app/mappa.tsx");
  const surface = source("src/components/PhaserMapSurface.web.tsx");
  assert.match(mappa, /useFocusEffect\(/);
  assert.match(mappa, /phaserMapRef\.current\?\.resumeInteractions\(\)/);
  assert.match(surface, /restoreMapAfterNavigation\(runtime\.game\)/);
});
