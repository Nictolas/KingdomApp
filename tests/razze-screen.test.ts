import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { SCHEDE_RAZZE, schedaDaRazza } from "../src/game/razzeNavigazione.ts";

test("Razze è disponibile dal menu e tutte e sette le razze sono elencate", () => {
  assert.equal(existsSync("app/razze.tsx"), true);
  const menu = readFileSync("src/screens/GridGame.tsx", "utf8");
  assert.match(menu, /router\.push\("\/razze"\)/);
  assert.match(menu, />Razze<\/Text>/);
  const screen = readFileSync("app/razze.tsx", "utf8");
  assert.match(screen, /SCHEDE_RAZZE\.map/);
  assert.equal(SCHEDE_RAZZE.length, 7);
  for (const razza of ["Umano", "Elfo", "Nano", "Orco", "Goblin", "Felix", "Golem"] as const) {
    assert.equal(schedaDaRazza(razza)?.razza, razza);
  }
});

test("Razze usa ritratti LPC premontati e fallback visibile durante il caricamento", () => {
  const screen=readFileSync("app/razze.tsx","utf8");
  const renderer=readFileSync("src/ui/RacePortrait.tsx","utf8");
  assert.match(screen, /<RacePortrait razza=\{item.razza\} emoji=\{item.emoji\}/);
  assert.match(renderer, /onLoad=\{\(\) => setLoaded\(true\)\}/);
  assert.match(renderer, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.match(renderer, /\(!loaded \|\| failed\)/);
  assert.equal(SCHEDE_RAZZE.find(item=>item.razza==="Golem")?.previewSeed,undefined);
  for (const race of ["umano","elfo","nano","orco","goblin","felix"]) {
    assert.equal(existsSync("assets/character-packs/lpc/race-portraits/"+race+".png"),true,race);
    assert.match(renderer,new RegExp("race-portraits/"+race+"\\.png"));
  }
});
