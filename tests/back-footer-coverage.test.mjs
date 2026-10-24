import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { needsBottomBackFooter } from "../src/navigation/needsBottomBackFooter";
import { isBuildingRoute } from "../src/navigation/isBuildingRoute";

const project = resolve(fileURLToPath(new URL("..", import.meta.url)));
const app = join(project, "app");

function routeFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name);
    return entry.isDirectory() ? routeFiles(full) : entry.name.endsWith(".tsx") ? [full] : [];
  });
}

const exempt = new Set([
  "_layout.tsx", "index.tsx", "mappa.tsx", "mappa-phaser-preview.tsx",
  "bar/index.tsx", "mensa/index.tsx", "felicita.tsx", "lealta.tsx",
  "paura.tsx", "religione.tsx", "chiesa/[id].tsx"
]);

function pathnameFromFile(filename) {
  const rel = relative(app, filename).split(sep).join("/");
  return "/" + rel.replace(/\.tsx$/, "").replace(/\/index$/, "").replace(/\[[^\]]+\]/g, "esempio");
}

test("ogni schermata reale ha uscita dedicata o barra Indietro globale", () => {
  const missing = [];
  for (const file of routeFiles(app)) {
    const rel = relative(app, file).split(sep).join("/");
    if (exempt.has(rel)) continue;
    const source = readFileSync(file, "utf8");
    const path = pathnameFromFile(file);
    // I wrapper delegano la navigazione al componente condiviso della scheda.
    const hasSharedFooter = rel.startsWith("sede-forestale/");
    const hasLocalFooter = source.includes("styles.footer");
    if (!hasLocalFooter && !hasSharedFooter &&
        !isBuildingRoute(path) && !needsBottomBackFooter(path)) missing.push(rel);
  }
  assert.deepEqual(missing, [], "Pagine senza comando di uscita inferiore");
});

test("la mappa non ha la barra Indietro e il Bosco usa il controllo edificio", () => {
  assert.equal(needsBottomBackFooter("/"), false);
  assert.equal(needsBottomBackFooter("/mappa"), false);
  assert.equal(isBuildingRoute("/bosco") || needsBottomBackFooter("/bosco"), true);
});

test("Soddisfazione ha barra ancorata al viewport senza footer duplicato", () => {
  assert.equal(needsBottomBackFooter("/soddisfazione"), true);
  const satisfaction = readFileSync(join(app, "soddisfazione.tsx"), "utf8");
  assert.doesNotMatch(satisfaction, /<View style=\{styles.footer\}>/);
  const webFooter = readFileSync(join(project, "src/navigation/BuildingBottomExit.web.tsx"), "utf8");
  assert.match(webFooter, /position: "fixed"/);
  assert.match(webFooter, /env\(safe-area-inset-bottom/);
  assert.match(webFooter, /needsBottomBackFooter/);
  const nativeFooter = readFileSync(join(project, "src/navigation/BuildingBottomExit.tsx"), "utf8");
  assert.match(nativeFooter, /insets.bottom/);
  const layout = readFileSync(join(app, "_layout.tsx"), "utf8");
  assert.match(layout, /100dvh/);
});
