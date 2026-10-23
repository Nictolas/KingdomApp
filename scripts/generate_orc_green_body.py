#!/usr/bin/env python3
"""Create green orc body LPC sheets from the existing olive body sheets.

LPC's shipped heads already have a green palette, but all body skin options are
human-coloured. Generate only the 12 body idle/walk sprites for orcs. Repeatable
and safe to re-run; it does not touch the original sheets.
"""
from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import json

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "src/character-system/generated/lpc-manifest.json"
SOURCES = ROOT / "src/character-system/generated/lpcAssetSources.ts"
SPRITES = ROOT / "assets/character-packs/lpc/generated"

# Map the exact olive *body* palette to the already-existing green orc head
# palette. Keep LPC's dark outline untouched and retain transparency.
GREEN_SKIN = {
    (228, 164, 124): (83, 191, 113),  # highlight
    (211, 139, 89): (57, 170, 78),    # base
    (174, 107, 63): (34, 130, 54),    # shade
    (127, 76, 49): (25, 84, 29),     # dark shade
    (68, 39, 37): (9, 50, 11),       # deepest shade
}
ORIGINAL_OUTLINE = (39, 25, 32)


def greenify_sheet(source: Path, target: Path) -> None:
    with Image.open(source) as image:
        base = image.convert("RGBA")
    original_pixels = list(base.getdata())
    recolored = [(*GREEN_SKIN.get((r, g, b), (r, g, b)), a) for r, g, b, a in original_pixels]
    original_skin = sum(1 for r, g, b, a in original_pixels if a > 0 and (r, g, b) in GREEN_SKIN)
    if original_skin < 100:
        raise ValueError(f"Body sheet has no expected skin palette: {source.name}")
    for (r, g, b, a), new in zip(original_pixels, recolored):
        if a and (r, g, b) in GREEN_SKIN and new[:3] == (r, g, b):
            raise ValueError("Human skin survived recoloring")
    base.putdata(recolored)
    target.parent.mkdir(parents=True, exist_ok=True)
    base.save(target, optimize=True)


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    original = manifest["assets"]
    baseline = [
        item for item in original
        if item["slot"] == "body" and item["color"] == "olive"
        and item["animation"] in ("idle", "walk")
    ]
    if len(baseline) != 12:
        raise ValueError(f"Expected 12 olive body sheets, found {len(baseline)}")

    to_add = []
    source_entries = []
    for item in baseline:
        variant = deepcopy(item)
        variant["color"] = "orc_green"
        variant["id"] = item["id"].replace(":olive:", ":orc_green:")
        if variant["id"] == item["id"]:
            raise ValueError(f"Unexpected manifest id: {item['id']}")
        name = f"lpc_orc_green_{item['bodyType']}_{item['animation']}"
        variant["sourceKey"] = name
        greenify_sheet(SPRITES / (item["sourceKey"] + ".png"), SPRITES / (name + ".png"))
        to_add.append(variant)
        source_entries.append(
            f'  "{name}": require("../../../assets/character-packs/lpc/generated/{name}.png"),'
        )

    # Child and pregnant bodies exist, but the upstream LPC pack has no
    # dedicated orc face sheets for them. Reuse the existing compatible green
    # teen/female faces (same 64px frame geometry) rather than fall back to a
    # pink human face or a missing sprite.
    extra_heads = []
    for target_type, source_type, semantic in [
        ("child", "teen", "orc_male"),
        ("pregnant", "female", "orc_female"),
    ]:
        for animation in ("idle", "walk"):
            head = next(x for x in original if
                x["slot"] == "raceFeatures" and
                x["bodyType"] == source_type and
                x["semanticId"] == semantic and
                x["color"] == "olive" and
                x["animation"] == animation)
            adapter = deepcopy(head)
            adapter["id"] = f"orc_green_adapted_head:{target_type}:{animation}"
            adapter["bodyType"] = target_type
            extra_heads.append(adapter)

    original = [x for x in original if x["color"] != "orc_green"
                and not x["id"].startswith("orc_green_adapted_head:")]
    original.extend(to_add)
    original.extend(extra_heads)
    original.sort(key=lambda x: (x["zPos"], x["id"]))
    manifest["assets"] = original
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    content = SOURCES.read_text(encoding="utf-8")
    content = "\n".join(line for line in content.split("\n") if "lpc_orc_green_" not in line)
    anchor = "\n};"
    if anchor not in content:
        raise ValueError("Unexpected generated sources format")
    content = content.replace(anchor, "\n" + "\n".join(source_entries) + anchor, 1)
    SOURCES.write_text(content, encoding="utf-8")
    print(f"Generated {len(to_add)} green orc body sheets and manifest records")


if __name__ == "__main__":
    main()
