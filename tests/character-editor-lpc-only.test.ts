import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("character creation uses only the Universal LPC editor", () => {
  const editorPath = resolve(process.cwd(), "src/ui/CreazioneGiocatoreModal.tsx");
  const legacyPreviewPath = resolve(process.cwd(), "src/ui/PixelAvatarPreview.tsx");
  const source = readFileSync(editorPath, "utf8");

  assert.equal(source.includes("PixelAvatarPreview"), false);
  assert.equal(source.includes("CharacterCreationPreview"), true);
  assert.equal(source.includes("Universal LPC"), true);
  assert.equal(existsSync(legacyPreviewPath), false);
});
