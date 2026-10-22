import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { LPC_RUNTIME_MANIFEST } from "../src/character-system/registry.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const cfg = JSON.parse(read("scripts/lpc-approved-assets.json")) as {
  items: Array<{ id: string; slot: string; definition: string; semantic: string; bodyTypes?: string[] }>;
};

test("l'importatore LPC conosce i file originali di strumenti e uniformi professionali", () => {
  const expected = [
    ["tool_axe", "accessory", "tools/tool_axe.json", "axe"],
    ["tool_hammer", "accessory", "tools/tool_hammer.json", "hammer"],
    ["tool_pickaxe", "accessory", "tools/tool_pickaxe.json", "pickaxe"],
    ["guard_helmet_barbuta", "headwear", "headwear/helmets/helmets/hat_helmet_barbuta.json", "helmet_barbuta"],
    ["wizard_hat_celestial", "headwear", "headwear/hats/magic/hat_magic_celestial.json", "magic_celestial"],
    ["medic_cravat", "neck", "headwear/neck/neck_cravat.json", "cravat"],
    ["medic_plain_mask", "facialMask", "headwear/accessories/facial_mask_plain.json", "plain_mask"],
    ["medic_sunglasses", "facialEyes", "headwear/accessories/glasses/facial_glasses_sunglasses.json", "sunglasses"]
  ];
  for (const [id, slot, definition, semantic] of expected) {
    const item = cfg.items.find((x) => x.id === id);
    assert.ok(item, `manca la definizione LPC di ${id}`);
    assert.equal(item?.slot, slot);
    assert.equal(item?.definition, definition);
    assert.equal(item?.semantic, semantic);
    assert.ok(item?.bodyTypes?.includes("teen"));
  }
});

test("il renderer riconosce accessori da collo, maschere e occhiali LPC", () => {
  const source = read("src/character-system/registry.ts");
  assert.match(source, /asset\.slot === "neck"[^\n]*appearance\.neckwear/);
  assert.match(source, /asset\.slot === "facialMask"[^\n]*appearance\.facialMask/);
  assert.match(source, /asset\.slot === "facialEyes"[^\n]*appearance\.facialEyes/);
  assert.match(source, /assetColorMatches\(asset, appearance, pool\)/);
});

test("non dichiara importati gli sprite degli strumenti finché il manifest non li contiene", () => {
  const imported = new Set(
    LPC_RUNTIME_MANIFEST.assets.filter((asset) => asset.slot === "accessory").map((asset) => asset.semanticId)
  );
  assert.ok(imported.has("watering_can"));
  for (const id of ["axe", "hammer", "pickaxe"]) {
    if (!imported.has(id)) {
      assert.ok(cfg.items.some((entry) => entry.semantic === id),
        `${id} deve essere configurato per il prossimo import LPC`);
    }
  }
});
