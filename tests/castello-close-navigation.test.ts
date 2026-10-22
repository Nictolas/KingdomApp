import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const castello = readFileSync(new URL("../app/castello.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../src/ui/BuildingScreenShell.tsx", import.meta.url), "utf8");

test("il Castello condivide header e navigazione fissa con gli edifici", () => {
  assert.match(castello, /<BuildingScreenShell[\s\S]*?title="Castello"/);
  assert.match(castello, /backLabel="Torna alla mappa"/);
  assert.match(castello, /onBack=\{\(\) => tornaAllaMappa\(router\)\}/);
  const layout = readFileSync(new URL("../app/_layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /<BuildingBottomExit\s*\/>/);
  assert.doesNotMatch(shell, /styles\.headerBack|styles\.footerBack/);
  // Le schede fullscreen nella mappa (senza route edificio) conservano
  // comunque la propria chiusura fissa IN BASSO.
  assert.match(shell, /showModalExit/);
  assert.match(shell, /<BuildingModalBottomExit onClose=\{onBack\}/);
});

test("il ritorno del Castello mantiene tornaAllaMappa senza rimontare la scena", () => {
  assert.match(castello, /import \{ tornaAllaMappa \} from/);
  assert.match(castello, /onBack=\{\(\) => tornaAllaMappa\(router\)\}/);
  assert.doesNotMatch(castello, /router\.replace\("\/mappa"\)/);
});

test("la base comune rispetta la status bar e la Home bar su iPhone", () => {
  assert.match(shell, /env\(safe-area-inset-top, 0px\)/);
  assert.match(shell, /env\(safe-area-inset-bottom, 0px\)/);
  assert.match(shell, /useSafeAreaInsets/);
  assert.match(shell, /display-mode: standalone/);
});
