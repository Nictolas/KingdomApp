import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("il Castello usa una dashboard desktop senza scroll pagina", () => {
  const source = readRepoFile("app/castello.tsx");

  assert.match(source, /const isDesktop = width >= 1100/);
  assert.match(source, /<View style=\{styles\.desktopViewport\}>\{dashboard\}<\/View>/);
  assert.match(source, /<ScrollView contentContainerStyle=\{styles\.mobileScrollContent\}/);
  assert.match(source, /dashboardDesktop:[\s\S]*flexDirection: "row"/);
});

test("il Castello compatta ministri, nobili e guardie mantenendo le azioni principali", () => {
  const source = readRepoFile("app/castello.tsx");

  assert.match(source, /nobili\.slice\(0, 3\)/);
  assert.match(source, /styles\.ministerTileDesktop/);
  assert.match(source, /router\.push\("\/ministri"\)/);
  assert.match(source, /rimuoviAbitanteDaEdificio\(a\.id, castello\.id\)/);
  assert.match(source, /setShowCambiaConsigliere\(true\)/);
});
