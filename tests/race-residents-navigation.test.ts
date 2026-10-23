import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { SCHEDE_RAZZE, schedaDaRazza, schedaDaSlug, abitantiPerRazza } from "../src/game/razzeNavigazione.ts";
import type { Abitante, Razza } from "../src/types.ts";

const resident = (id: number, nome: string, razza?: Razza) =>
  ({ id, nome, razza } as Abitante);

test("sette razze, sette percorsi pubblici distinti, incluso /razze/nani", () => {
  assert.equal(SCHEDE_RAZZE.length, 7);
  assert.equal(new Set(SCHEDE_RAZZE.map((i) => i.razza)).size, 7);
  assert.equal(new Set(SCHEDE_RAZZE.map((i) => i.slug)).size, 7);
  for (const item of SCHEDE_RAZZE) {
    assert.equal(schedaDaRazza(item.razza), item);
    assert.equal(schedaDaSlug(item.slug), item);
    assert.ok(/^[a-z]+$/.test(item.slug));
  }
  assert.equal(schedaDaSlug("nani")?.razza, "Nano");
  assert.equal(schedaDaSlug("felix")?.razza, "Felix");
  assert.equal(schedaDaSlug("umani")?.razza, "Umano");
  assert.equal(schedaDaSlug("inesistente"), undefined);
});

test("il filtro mostra solo i residenti della razza e non altera lo stato", () => {
  const original = [
    resident(6, "Zoe", "Nano"), resident(1, "Marco", "Umano"),
    resident(7, "Anna", "Nano"), resident(8, "Agnese", "Nano"),
    resident(4, "Felix I", "Felix"), resident(3, "Gianni", "Goblin"),
    resident(2, "Clara")
  ];
  assert.deepEqual(abitantiPerRazza(original, "Nano").map(a => a.id), [8,7,6]);
  assert.deepEqual(abitantiPerRazza(original, "Umano").map(a => a.id), [2,1]);
  assert.deepEqual(abitantiPerRazza(original, "Felix").map(a => a.id), [4]);
  assert.deepEqual(abitantiPerRazza(original, "Golem"), []);
  assert.deepEqual(original.map(a => a.id), [6,1,7,8,4,3,2]);
  const changed = [...original.filter(a => a.id !== 7), resident(10, "Brom", "Nano")];
  assert.deepEqual(abitantiPerRazza(changed, "Nano").map(a => a.id), [8,10,6]);
});

test("le schede aprono dettagli responsivi con sprite e nome", () => {
  const index = readFileSync("app/razze.tsx", "utf8");
  const detail = readFileSync("app/razze/[razza].tsx", "utf8");
  assert.match(index, /onPress=\{\(\) => router\.push/);
  assert.match(index, /item\.slug/);
  assert.match(detail, /useLocalSearchParams/);
  assert.match(detail, /abitantiPerRazza\(abitanti, scheda\.razza\)/);
  assert.match(detail, /<AbitanteAvatarPreview abitante=\{abitante\}/);
  assert.match(detail, /\{abitante\.nome\}/);
  assert.match(detail, /elenco\.length === 0/);
  assert.match(detail, /router\.replace\("\/razze"\)/);
  assert.match(detail, /width < 460 \? 2/);
  assert.match(detail, /#0a2346/);
});

test("Vercel serve l'app anche su URL diretti, inclusi percorsi profondi", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.equal(config.buildCommand, "npm run build:web");
  assert.equal(config.outputDirectory, "dist");
  assert.ok(config.rewrites.some((item: {source:string;destination:string}) =>
    item.source === "/(.*)" && item.destination === "/index.html"));
});
