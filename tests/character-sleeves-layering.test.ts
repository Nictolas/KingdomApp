import assert from "node:assert/strict";
import test from "node:test";

import { creaCharacterAppearance } from "../src/game/personaggioAspetto.ts";
import { normalizeCharacterAppearance } from "../src/character-system/appearance.ts";
import {
  LPC_RUNTIME_MANIFEST,
  compatibleCatalogOptions,
  firstCompatibleColorForField,
  resolveCharacterLayers
} from "../src/character-system/registry.ts";
import {
  filterTorsoOutfitOptions, partitionLongsleeveTorsoOptions,
  groupCatalogOptionsByLpcSections, LPC_TORSO_SECTIONS, LPC_MANICHE_TORSO_SECTIONS
} from "../src/character-system/lpcCatalogSections.ts";
import { LPC_CREDIT_DEFINITIONS } from "../src/character-system/generated/lpcCreditDefinitions";

test("Busto e Maniche sono due indumenti persistenti sovrapposti e con colori indipendenti", () => {
  const base = creaCharacterAppearance("Umano", "teen");
  const torso = filterTorsoOutfitOptions(compatibleCatalogOptions(base).upperOutfits, base.bodyType);
  const { rest: busti, manicheSleeves: maniche } = partitionLongsleeveTorsoOptions(torso, base.bodyType);
  const hasIdle = (id: string) => LPC_RUNTIME_MANIFEST.assets.some((asset) =>
    asset.animation === "idle" && asset.bodyType === base.bodyType &&
    asset.slot === "outfit" && asset.semanticId === id
  );
  const busto = busti.find(hasIdle);
  const manica = maniche.find(hasIdle);
  assert.ok(busto, "Serve un indumento Busto LPC per il corpo teen");
  assert.ok(manica, "Servono maniche LPC indipendenti per il corpo teen");

  const bustoColor = firstCompatibleColorForField(base, "outfitPrimaryColor", "outfit", busto);
  const sleeveColor = firstCompatibleColorForField(base, "outfitPrimaryColor", "outfit", manica);
  const withBoth = normalizeCharacterAppearance({
    ...base, fullOutfit: "none", upperOutfit: busto, outfitPrimaryColor: bustoColor,
    sleeveOutfit: manica, sleeveColor
  });
  const layers = resolveCharacterLayers(withBoth, "idle");
  const bustoLayers = layers.filter((asset) => asset.layer === "outfit" && asset.semanticId === busto);
  const sleeveLayers = layers.filter((asset) => asset.layer === "outfit" && asset.semanticId === manica);
  assert.ok(bustoLayers.length > 0, "Selezionare Maniche non deve rimuovere Busto");
  assert.ok(sleeveLayers.length > 0, "Le Maniche devono essere presenti nel renderer");
  assert.ok(Math.min(...sleeveLayers.map((asset) => asset.zPos)) >
    Math.max(...bustoLayers.map((asset) => asset.zPos)), "Le Maniche devono essere disegnate sopra Busto");

  const recolored = normalizeCharacterAppearance({ ...withBoth, sleeveColor: "red" });
  assert.equal(recolored.upperOutfit, busto);
  assert.equal(recolored.outfitPrimaryColor, bustoColor, "Il colore Busto rimane invariato");
  assert.equal(recolored.sleeveOutfit, manica);

  const withoutSleeves = normalizeCharacterAppearance({ ...withBoth, sleeveOutfit: "none" });
  assert.equal(withoutSleeves.upperOutfit, busto, "Rimuovere Maniche non elimina Busto");
  assert.equal(withoutSleeves.outfitPrimaryColor, bustoColor);

  const restored = normalizeCharacterAppearance(JSON.parse(JSON.stringify(withBoth)));
  assert.equal(restored.upperOutfit, busto, "Il Busto deve essere salvato");
  assert.equal(restored.sleeveOutfit, manica, "Le Maniche devono essere salvate separatamente");
  assert.equal(restored.sleeveColor, sleeveColor, "Il colore delle maniche deve essere salvato");
});

test("Shirts · Sleeves viene mostrato solo in Maniche, non in Busto", () => {
  const base = creaCharacterAppearance("Umano", "teen");
  const all = filterTorsoOutfitOptions(compatibleCatalogOptions(base).upperOutfits, base.bodyType);
  const { rest: busti, manicheSleeves: maniche } = partitionLongsleeveTorsoOptions(all, base.bodyType);
  const definitions = LPC_CREDIT_DEFINITIONS;
  const shortSleeves = [...new Set(LPC_RUNTIME_MANIFEST.assets
    .filter((asset) =>
      asset.bodyType === base.bodyType && asset.slot === "outfit" &&
      definitions[asset.attributionId]?.includes("/sleeves/") &&
      !definitions[asset.attributionId]?.includes("longsleeve") &&
      all.includes(asset.semanticId))
    .map((asset) => asset.semanticId))];
  assert.ok(shortSleeves.length > 0, "La collezione LPC teen deve contenere Shirts · Sleeves");
  assert.ok(shortSleeves.every((id) => maniche.includes(id)), "Tutti gli Shirts · Sleeves devono essere nella scheda Maniche");
  assert.ok(shortSleeves.every((id) => !busti.includes(id)), "Shirts · Sleeves non devono apparire nella scheda Busto");
  const bustoGroups = groupCatalogOptionsByLpcSections(busti, base.bodyType, "outfit", LPC_TORSO_SECTIONS);
  const manicheGroups = groupCatalogOptionsByLpcSections(maniche, base.bodyType, "outfit", LPC_MANICHE_TORSO_SECTIONS);
  assert.ok(!bustoGroups.some((g) => g.label === "Shirts · Sleeves"));
  assert.ok(manicheGroups.some((g) => g.label === "Shirts · Sleeves"));
});
