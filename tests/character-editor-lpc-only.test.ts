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

  const immigrationSource = readFileSync(resolve(process.cwd(), "app/immigrazione.tsx"), "utf8");
  const residentModalSource = readFileSync(resolve(process.cwd(), "src/ui/AbitanteInfoModal.tsx"), "utf8");
  assert.equal(immigrationSource.includes("PixelAvatarPreview"), false);
  assert.equal(residentModalSource.includes("PixelAvatarPreview"), false);
  assert.equal(immigrationSource.includes("AbitanteLpcAvatar"), true);
  assert.equal(residentModalSource.includes("AbitanteLpcAvatar"), true);
});

test("mobile character creation is fullscreen with scrollable options and two rotation buttons", () => {
  const editor = readFileSync(resolve(process.cwd(), "src/ui/CreazioneGiocatoreModal.tsx"), "utf8");
  const preview = readFileSync(resolve(process.cwd(), "src/ui/CharacterCreationPreview.tsx"), "utf8");

  assert.ok(editor.includes("transparent={false}"));
  assert.ok(editor.includes("contentContainerStyle: styles.editorLayoutMobileContent"));
  assert.ok(editor.includes("controlsScrollMobile"));
  assert.ok(editor.includes("SafeAreaView"));
  assert.equal(editor.includes("🛡️"), false);
  assert.equal(editor.includes("Configura un personaggio pixel-art modulare"), false);
  assert.equal(editor.toLowerCase().includes("corpo teen"), false);
  assert.equal(editor.includes('maxWidth: 440'), false);

  const rotationControls = [...preview.matchAll(/accessibilityLabel="Ruota a (sinistra|destra)"/g)];
  assert.deepEqual(rotationControls.map((match) => match[1]), ["sinistra", "destra"]);
  assert.equal(preview.includes("styles.dpad"), false);
});
