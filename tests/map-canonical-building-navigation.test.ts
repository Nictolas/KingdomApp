import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { tornaAllaMappa } from "../src/navigation/tornaAllaMappa.ts";

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("la home non monta una seconda istanza di MappaScreen e Phaser", () => {
  const home = source("app/index.tsx");
  const map = source("app/mappa.tsx");
  assert.match(home, /<Redirect href="\/mappa" \/>/);
  assert.doesNotMatch(home, /<MappaScreen\s*\/>/);
  assert.match(map, /export function MappaScreen\(/);
  assert.match(map, /<PhaserMapSurface/);
});

test("ritorno dal Bar e dagli altri edifici riutilizza /mappa, mai una nuova home", () => {
  const visited: string[] = [];
  const router = { navigate: (href: string) => visited.push(href) };
  tornaAllaMappa(router as Parameters<typeof tornaAllaMappa>[0]);
  tornaAllaMappa(router as Parameters<typeof tornaAllaMappa>[0]);
  assert.deepEqual(visited, ["/mappa", "/mappa"]);
  assert.doesNotMatch(source("src/navigation/tornaAllaMappa.ts"), /navigate\("\/"\)/);

  for (const path of [
    "app/bar/[id].tsx",
    "app/mensa/[id].tsx",
    "app/serra/[id].tsx",
    "app/castello.tsx"
  ]) {
    const route = source(path);
    assert.match(route, /tornaAllaMappa\(router\)/, `${path} deve usare il ritorno canonico`);
  }
});

test("il ripristino input Phaser continua ad essere invocato al ritorno", () => {
  const mappa = source("app/mappa.tsx");
  assert.match(mappa, /useFocusEffect\(/);
  assert.match(mappa, /phaserMapRef\.current\?\.resumeInteractions\(\)/);
  assert.match(mappa, /phaserMapRef\.current\?\.refreshViewport\(\)/);
});
