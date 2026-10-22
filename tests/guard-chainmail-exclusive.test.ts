import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DEFAULT_CHARACTER_APPEARANCE,
  GUARD_CHAINMAIL_OUTFIT,
  appearanceForPublicSpace,
  enforceProfessionAccessoryRules,
  isGuardChainmailOutfit,
  normalizeCharacterAppearance,
  stripGuardChainmailFromCivilian
} from "../src/character-system/appearance.ts";
import { LPC_RUNTIME_MANIFEST, resolveCharacterLayers } from "../src/character-system/registry.ts";

const rules = (lavoro: string, razza = "Umano", sesso: "M" | "F" = "M") =>
  ({ isKing: false, nudismoAttivo: false, lavoro, razza, sesso });

test("il catalogo LPC guard_chainmail usa l'outfit semantico guard e supporta l'animazione", () => {
  assert.equal(GUARD_CHAINMAIL_OUTFIT, "guard");
  const assets = LPC_RUNTIME_MANIFEST.assets.filter(
    (asset) => asset.id.startsWith("guard_chainmail") &&
      asset.slot === "outfit" &&
      asset.semanticId === GUARD_CHAINMAIL_OUTFIT
  );
  assert.ok(assets.some((a) => a.animation === "idle" && a.bodyType === "teen"));
  assert.ok(assets.some((a) => a.animation === "walk" && a.bodyType === "teen"));
  assert.ok(assets.some((a) => a.bodyType === "male"));
  assert.ok(assets.some((a) => a.bodyType === "female"));
});

test("ogni Guardia indossa Chainmail automaticamente in idle e walk", () => {
  for (const sesso of ["M", "F"] as const) {
    const base = normalizeCharacterAppearance({ ...DEFAULT_CHARACTER_APPEARANCE, bodyType: sesso === "F" ? "female" : "male" });
    const originale = { ...base };
    const guardia = appearanceForPublicSpace(base, rules("Guardia", "Umano", sesso));
    assert.equal(guardia.outfit, GUARD_CHAINMAIL_OUTFIT);
    assert.equal(guardia.upperOutfit, GUARD_CHAINMAIL_OUTFIT);
    assert.equal(guardia.fullOutfit, "none");
    assert.equal(guardia.sleeveOutfit, "none");
    assert.deepEqual(base, originale, "il cambio di lavoro non deve modificare l'aspetto persistito");
    for (const animazione of ["idle", "walk"] as const) {
      const layers = resolveCharacterLayers(guardia, animazione);
      assert.ok(layers.some((layer) => layer.layer === "outfit" &&
        layer.semanticId === GUARD_CHAINMAIL_OUTFIT &&
        layer.id.startsWith("guard_chainmail")), `Guardia ${sesso} / ${animazione}`);
    }
  }
});

test("anche le Guardie Nane con corpo child mostrano la cotta di maglia", () => {
  const nano = normalizeCharacterAppearance({ ...DEFAULT_CHARACTER_APPEARANCE, race: "dwarf", bodyType: "child" });
  const guardia = appearanceForPublicSpace(nano, rules("Guardia", "Nano"));
  assert.equal(guardia.bodyType, "child");
  assert.equal(guardia.upperOutfit, GUARD_CHAINMAIL_OUTFIT);
  assert.ok(resolveCharacterLayers(guardia, "idle").some((layer) =>
    layer.layer === "outfit" && layer.semanticId === GUARD_CHAINMAIL_OUTFIT
  ));
  assert.ok(resolveCharacterLayers(guardia, "walk").some((layer) =>
    layer.layer === "outfit" && layer.semanticId === GUARD_CHAINMAIL_OUTFIT
  ));
});

test("i Medici non ricevono Chainmail, nemmeno il cappuccio in maglia", () => {
  const medico = appearanceForPublicSpace(DEFAULT_CHARACTER_APPEARANCE, rules("Medico"));
  assert.equal(medico.headwear, "none");
  assert.equal(medico.fullOutfit, "kimono");
  assert.ok(!isGuardChainmailOutfit(medico.outfit));
  assert.ok(!isGuardChainmailOutfit(medico.upperOutfit));
  assert.ok(!resolveCharacterLayers(medico, "idle").some((layer) =>
    layer.layer === "outfit" && layer.semanticId === GUARD_CHAINMAIL_OUTFIT
  ));
});

test("non Guardie ed ex Guardie non possono conservare Chainmail da un vecchio salvataggio", () => {
  const vecchioAspetto = normalizeCharacterAppearance({
    ...DEFAULT_CHARACTER_APPEARANCE,
    outfit: GUARD_CHAINMAIL_OUTFIT,
    upperOutfit: GUARD_CHAINMAIL_OUTFIT,
    sleeveOutfit: GUARD_CHAINMAIL_OUTFIT
  });
  const salvatoPrima = { ...vecchioAspetto };
  for (const lavoro of ["Disoccupato", "Medico", "Agricoltore", "Fabbro"]) {
    const cittadino = appearanceForPublicSpace(vecchioAspetto, rules(lavoro));
    assert.ok(!isGuardChainmailOutfit(cittadino.outfit), lavoro);
    assert.ok(!isGuardChainmailOutfit(cittadino.upperOutfit), lavoro);
    assert.ok(!isGuardChainmailOutfit(cittadino.sleeveOutfit), lavoro);
  }
  assert.deepEqual(vecchioAspetto, salvatoPrima, "nessuna migrazione distruttiva dei salvataggi");
  const civil = stripGuardChainmailFromCivilian(vecchioAspetto);
  assert.equal(isGuardChainmailOutfit(civil.upperOutfit), false);
  assert.equal(enforceProfessionAccessoryRules(DEFAULT_CHARACTER_APPEARANCE, "Guardia").upperOutfit, "guard");
});

test("l'editor di Re e Sacerdote non permette di selezionare Chainmail", () => {
  const editor = readFileSync(new URL("../src/ui/CreazioneGiocatoreModal.tsx", import.meta.url), "utf8");
  assert.match(editor, /filterTorsoOutfitOptions\(catalogOptions\.upperOutfits, spriteAppearance\.bodyType\)\.filter\(\(id\) => !isGuardChainmailOutfit\(id\)\)/);
  assert.match(editor, /stripGuardChainmailFromCivilian\(initialAppearance\.characterAppearance\)/);
});
