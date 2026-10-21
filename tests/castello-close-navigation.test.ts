import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/castello.tsx", import.meta.url), "utf8");

test("il Castello mostra il pulsante fisso in basso soltanto su mobile", () => {
  // Verifica i componenti direttamente: l'indentazione JSX non e' parte del contratto UI.

  assert.match(source, /<ScrollView contentContainerStyle=\{styles\.mobileScrollContent\}/);
  assert.match(source, /!isDesktop \? \(\s*<View style=\{\[styles\.mobileCloseFooter, bottomSafeArea\]\}>/);
  assert.match(source, /<Text style=\{styles\.mobileCloseActionText\}>← Torna alla mappa<\/Text>/);
  assert.match(source, /mobileCloseAction:\s*\{\s*minHeight: 52,/);
});

test("sia la X sia il tasto in basso riportano alla mappa, senza rimontare la scena", () => {
  assert.match(source, /accessibilityLabel="Chiudi Castello e torna alla mappa"/);
  assert.equal((source.match(/onPress=\{\(\) => tornaAllaMappa\(router\)\}/g) ?? []).length, 3);
  assert.match(source, /<Text style=\{styles\.closeButtonText\}>×<\/Text>/);
  assert.match(source, /accessibilityRole="button"/);
});

test("la web app iPhone rispetta gli inset della status bar e della barra Home", () => {
  assert.match(source, /env\(safe-area-inset-top, 0px\)/);
  assert.match(source, /env\(safe-area-inset-bottom, 0px\)/);
  assert.match(source, /SafeAreaView style=\{\[styles\.safe, topSafeArea\]\}/);
  assert.match(source, /Platform\.OS === "web" && !isDesktop/);
});