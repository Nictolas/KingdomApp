import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { EDIFICIO_TO_ROUTE } from "../src/game/mappaEdificioRoutes.ts";
import { isBuildingRoute } from "../src/navigation/isBuildingRoute.ts";

const src = (name: string) => readFileSync(new URL("../" + name, import.meta.url), "utf8");

test("tutte le pagine edificio (anche quelle future nel catalogo) ricevono la barra in basso", () => {
  const routes = [...new Set(Object.values(EDIFICIO_TO_ROUTE))];
  assert.ok(routes.length >= 20);
  for (const route of routes) {
    assert.equal(isBuildingRoute(route), true, route);
    assert.equal(isBuildingRoute(route + "/42"), true, "future dynamic route " + route);
    const basename = route.slice(1);
    assert.ok(
      existsSync(new URL("../app/" + basename + ".tsx", import.meta.url)) ||
      existsSync(new URL("../app/" + basename + "/[id].tsx", import.meta.url)),
      "Route senza schermata: " + route
    );
  }
  for (const path of ["/", "/mappa", "/diario", "/menu", "/edifici", "/abitanti"]) {
    assert.equal(isBuildingRoute(path), false, path);
  }
});

test("il navigatore contiene un solo pulsante globale sotto lo Stack, fuori dallo scroll", () => {
  const layout = src("app/_layout.tsx");
  const footer = src("src/navigation/BuildingBottomExit.web.tsx");
  const nativeFooter = src("src/navigation/BuildingBottomExit.tsx");
  assert.match(layout, /<Stack[\s\S]*<BuildingBottomExit\s*\/>/);
  assert.match(footer, /isBuildingRoute\(pathname\)/);
  assert.match(footer, /accessibilityLabel="Torna alla mappa"/);
  assert.match(footer, /minHeight: 56/);
  assert.match(footer, /createPortal\(/);
  assert.match(footer, /position: "fixed"/);
  assert.match(footer, /document\.body/);
  assert.match(nativeFooter, /Math\.max\(insets\.bottom, 12\)/);
  assert.match(footer, /env\(safe-area-inset-bottom/);
  assert.match(footer, /tornaAllaMappa\(router\)/);
});

test("nessun edificio legacy espone piu pulsanti di uscita locali, in alto o sotto lo scroll", () => {
  const routes = [...new Set(Object.values(EDIFICIO_TO_ROUTE))];
  const files = routes.flatMap((r) => {
    const name = r.slice(1);
    return [
      "app/" + name + ".tsx",
      "app/" + name + "/[id].tsx"
    ].filter(path => existsSync(new URL("../" + path, import.meta.url)));
  });
  for (const path of files) {
    const contents = src(path);
    assert.doesNotMatch(contents, /style=\{styles\.back\}\s+onPress=\{\(\) => router\.back\(\)\}/, path);
    assert.doesNotMatch(contents, /<View style=\{styles\.footer\}>\s*<Text style=\{styles\.back\}/, path);
  }
  assert.doesNotMatch(src("src/ui/BuildingScreenShell.tsx"), /styles\.headerBack/);
});

test("anche Bosco assente e schermate Bar/Serra/Mensa mancanti restano navigabili", () => {
  for (const path of ["app/bosco.tsx", "app/bar/[id].tsx", "app/serra/[id].tsx", "app/mensa/[id].tsx"]) {
    const text = src(path);
    assert.doesNotMatch(text, /← Indietro/, path);
  }
  assert.match(src("src/ui/BuildingScreenShell.tsx"), /showModalExit\s*=\s*!isBuildingRoute\(usePathname\(\)\)/);
  assert.match(src("src/ui/BuildingScreenShell.tsx"), /<BuildingModalBottomExit onClose=\{onBack\}/);
});

test("Luoghi di Culto e finestre info/Campo chiudono soltanto con barra sotto lo scroll", () => {
  const culto = src("src/ui/LuogoCultoFullscreenModal.tsx");
  assert.doesNotMatch(culto, /style=\{\(\{ pressed \}\) => \[styles\.closeBtn/);
  assert.match(culto, /<BuildingModalBottomExit onClose=\{onClose\}\s*\/>/);
  for (const file of ["src/ui/EdificioInfoModal.tsx", "src/ui/CampoDiLavoroModal.tsx"]) {
    const code = src(file);
    assert.match(code, /<BuildingModalBottomExit onClose=\{onClose\}\s*\/>/);
    assert.doesNotMatch(code, /<Pressable style=\{styles\.closeButton\} onPress=\{onClose\}>/);
  }
});
