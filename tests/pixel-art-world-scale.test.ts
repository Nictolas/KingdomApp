import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { CELL_SIZE_PX, FIXED_MAP_COLS, FIXED_MAP_ROWS } from "../src/game/mappaLayoutConfig";
import { OVERWORLD_SHEET_PX } from "../src/game/overworldSpritesheetLayout";
import { LPC_SHEETS } from "../src/character-system/lpcPack";

test("mondo e personaggi condividono la scala nativa di 64 pixel", () => {
  assert.equal(CELL_SIZE_PX, 64);
  assert.equal(CELL_SIZE_PX, OVERWORLD_SHEET_PX.tile);
  assert.equal(CELL_SIZE_PX, LPC_SHEETS["lpc-human-male-idle"].frameWidth);
  assert.equal(CELL_SIZE_PX, LPC_SHEETS["lpc-human-male-idle"].frameHeight);
  assert.deepEqual([FIXED_MAP_COLS, FIXED_MAP_ROWS], [50, 50]);
});

test("render pixel art a dimensioni native senza stiramenti dei tasselli", () => {
  const surface = readFileSync(new URL("../src/components/PhaserMapSurface.web.tsx", import.meta.url), "utf8");
  const scene = readFileSync(new URL("../src/phaser/scenes/KingdomMapScene.ts", import.meta.url), "utf8");
  assert.match(surface, /pixelArt:\s*true/);
  assert.match(surface, /imageRendering:\s*"pixelated"/);
  assert.doesNotMatch(scene, /snapshot\.cellSize\s*\*\s*1\.08/);
  assert.doesNotMatch(scene, /snapshot\.cellSize\s*\+\s*bleed/);
  assert.match(scene, /\.setDisplaySize\(snapshot\.cellSize, snapshot\.cellSize\)/);
});

test("sprite proporzionati al 118% e zoom iniziale mobile 112%", () => {
  const scene = readFileSync(new URL("../src/phaser/scenes/KingdomMapScene.ts", import.meta.url), "utf8");
  assert.match(scene, /const CHARACTER_VISUAL_SCALE = 1\.18;/);
  assert.match(scene, /const MOBILE_INITIAL_CAMERA_ZOOM = 1\.12;/);
  assert.match(scene, /setDisplaySize\(displaySize, displaySize\)/);
  assert.equal((scene.match(/\.setDisplaySize\(displaySize, displaySize\)/g) ?? []).length, 1);
  assert.match(scene, /const displaySize = snapshot\.cellSize \* CHARACTER_VISUAL_SCALE;/);
  assert.match(scene, /getLpcVisualGeometry\(snapshot.cellSize/);
  assert.match(scene, /camera\.setZoom\(this\.scale\.width <= MOBILE_VIEWPORT_MAX_WIDTH \? MOBILE_INITIAL_CAMERA_ZOOM : 1\)/);
  assert.match(scene, /root\.setSize\(snapshot\.cellSize, snapshot\.cellSize\)\.setInteractive\(\)/);
});
