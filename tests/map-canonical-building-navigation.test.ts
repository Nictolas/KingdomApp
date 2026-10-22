import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tornaAllaMappa } from "../src/navigation/tornaAllaMappa.ts";

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/** Extract the route's default component, not some incidental JSX elsewhere. */
function rootRoutes() {
  const root = source("app/index.tsx");
  const map = source("app/mappa.tsx");
  const nav = source("src/navigation/tornaAllaMappa.ts");
  return { root, map, nav };
}

test("startup Adventure/Creative mounts a real map at /, not a redirect cycle", () => {
  const { root, map } = rootRoutes();
  assert.match(root, /import \{ MappaScreen \} from "\.\/mappa"/);
  assert.match(root, /export default function Index\(\)\s*\{\s*return <MappaScreen\s*\/>/);
  assert.doesNotMatch(root, /<Redirect\s+href=/);
  assert.match(map, /export function MappaScreen\(\)/);
  assert.match(map, /export default function MappaRoute\(\)\s*\{\s*return <Redirect href="\/"\s*\/>/);
  // Regressione #260: / -> /mappa e /mappa -> / causavano schermo bianco.
  assert.equal((root.match(/<Redirect\s+href=/g) ?? []).length, 0);
  assert.equal((map.match(/<Redirect href="\/"\s*\/>/g) ?? []).length, 1);
});

test("dopo Bar, Serra, Mensa e Castello la navigazione torna alla root senza redirect", () => {
  const visited: string[] = [];
  const router = { navigate: (href: string) => visited.push(href) };
  tornaAllaMappa(router as Parameters<typeof tornaAllaMappa>[0]);
  tornaAllaMappa(router as Parameters<typeof tornaAllaMappa>[0]);
  assert.deepEqual(visited, ["/", "/"]);

  const { nav, root } = rootRoutes();
  assert.match(nav, /router\.navigate\("\/"\)/);
  assert.match(root, /<MappaScreen\s*\/>/);

  for (const path of [
    "app/bar/[id].tsx",
    "app/mensa/[id].tsx",
    "app/serra/[id].tsx",
    "app/castello.tsx"
  ]) {
    assert.match(source(path), /tornaAllaMappa\(router\)/, path);
  }
});

test("il ripristino input Phaser resta disponibile dopo il ritorno", () => {
  const mappa = source("app/mappa.tsx");
  assert.match(mappa, /useFocusEffect\(/);
  assert.match(mappa, /phaserMapRef\.current\?\.resumeInteractions\(\)/);
  assert.match(mappa, /phaserMapRef\.current\?\.refreshViewport\(\)/);
});
