import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { needsBottomBackFooter } from "../src/navigation/needsBottomBackFooter";

const project = resolve(fileURLToPath(new URL("..", import.meta.url)));
const app = join(project, "app");

function routeFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return entry.name.endsWith(".tsx") ? [full] : [];
  });
}

// Home, anteprima della mappa, reindirizzamenti e involucri che hanno
// una navigazione dedicata in un componente condiviso.
const exempt = new Set([
  "_layout.tsx",
  "index.tsx",
  "mappa.tsx",
  "mappa-phaser-preview.tsx",
  "bar/index.tsx",
  "mensa/index.tsx",
  "felicita.tsx",
  "lealta.tsx",
  "paura.tsx",
  "religione.tsx",
  "chiesa/[id].tsx"
]);

function pathnameFromFile(filename) {
  const rel = relative(app, filename).split(sep).join("/");
  return "/" + rel.replace(/\.tsx$/, "").replace(/\/index$/, "").replace(/\[[^\]]+\]/g, "esempio");
}

test("ogni pagina reale offre navigazione dal fondo o un footer specifico", () => {
  const missing = [];
  for (const file of routeFiles(app)) {
    const rel = relative(app, file).split(sep).join("/");
    if (exempt.has(rel)) continue;
    const source = readFileSync(file, "utf8");
    const hasLocalFooter = source.includes("styles.footer");
    const hasSharedFooter = rel === "sede-forestale/[id].tsx";
    if (!hasLocalFooter && !hasSharedFooter && !needsBottomBackFooter(pathnameFromFile(file))) {
      missing.push(rel);
    }
  }
  assert.deepEqual(missing, [], "Rotte senza possibilità di tornare indietro dal fondo");
});

test("la barra globale compare sulle rotte prive di footer e mai sulla mappa", () => {
  for (const page of [
    "/soddisfazione",
    "/abitanti",
    "/bosco",
    "/bar/123",
    "/chiesa/123",
    "/mensa/123",
    "/"
  ]) {
    assert.equal(needsBottomBackFooter(page), false, page);
  }
  for (const page of [
    "/menu",
    "/amministrazione",
    "/emporio",
    "/fucina",
    "/impresa/42",
    "/lavori/minatore",
    "/miniera",
    "/multiplayer",
    "/nudismo",
    "/obiettivi",
    "/richezza",
    "/serra",
    "/timore"
  ]) {
    assert.equal(needsBottomBackFooter(page), true, page);
  }
});

test("la cornice web usa l'altezza visibile per non nascondere i footer", () => {
  const layout = readFileSync(join(app, "_layout.tsx"), "utf8");
  assert.match(layout, /height = "100dvh"/);
  assert.match(layout, /<View style=\{routeShellStyle\}>/);
  assert.match(layout, /showBottomBack &&/);
});
