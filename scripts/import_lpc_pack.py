#!/usr/bin/env python3
"""Build a small deterministic runtime pack from the local Universal LPC source repository."""
from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path
from typing import Any

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/source-packs/Universal-LPC-Full/Universal-LPC-Spritesheet-Character-Generator-master"
CONFIG = ROOT / "scripts/lpc-approved-assets.json"
OUT_ASSETS = ROOT / "assets/character-packs/lpc/generated"
OUT_GENERATED = ROOT / "src/character-system/generated"


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def palette(material: str, color: str) -> tuple[list[str], list[str]] | None:
    if color == "base":
        return None
    meta = load_json(SOURCE / f"palette_definitions/{material}/meta_{material}.json")
    palettes = load_json(SOURCE / f"palette_definitions/{material}/{material}_{meta['default']}.json")
    base = meta["base"]
    if color not in palettes:
        raise ValueError(f"Palette {material}:{color} inesistente")
    return palettes[base], palettes[color]


def recolor(source: Path, destination: Path, mappings: list[tuple[list[str], list[str]]]) -> None:
    image = Image.open(source).convert("RGBA")
    replacements: dict[tuple[int, int, int], tuple[int, int, int]] = {}
    for base, target in mappings:
        for before, after in zip(base, target):
            replacements[tuple(bytes.fromhex(before[1:]))] = tuple(bytes.fromhex(after[1:]))
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a and (r, g, b) in replacements:
                nr, ng, nb = replacements[(r, g, b)]
                pixels[x, y] = nr, ng, nb, a
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, optimize=True)


def recolor_spec(definition: dict[str, Any], color: str) -> list[tuple[list[str], list[str]]]:
    recolors = definition.get("recolors")
    if not recolors or color == "base":
        return []
    specs = list(recolors.values()) if "material" not in recolors else [recolors]
    result = []
    for spec in specs:
        material = spec.get("material")
        if not material or material == "eye":
            continue
        mapping = palette(material, color)
        if mapping:
            result.append(mapping)
        break
    return result


def source_for(base: Path, animation: str, color: str) -> tuple[Path, bool]:
    direct = base / f"{animation}.png"
    if direct.exists():
        return direct, True
    variant = base / animation / f"{color}.png"
    if variant.exists():
        return variant, False
    fallback = base / animation / "white.png"
    if fallback.exists():
        return fallback, False
    raise FileNotFoundError(f"Nessun PNG per {base.relative_to(SOURCE)} {animation} {color}")


def discovered_teen_items() -> list[dict[str, Any]]:
    """Indicizza automaticamente gli elementi LPC autonomi compatibili con il corpo teen."""
    groups = [
        ("hair", "hair/**/hair_*.json", "hairFront", "$hair", "hairColor"),
        ("upper", "torso/shirts/**/*.json", "outfit", ["base"], "outfitPrimaryColor"),
        ("lower_pants", "legs/pants/**/*.json", "lowerBody", ["base"], "outfitSecondaryColor"),
        ("lower_skirts", "legs/skirts/**/*.json", "lowerBody", ["base"], "outfitSecondaryColor"),
        ("full", "torso/dresses/**/*.json", "fullOutfit", ["base"], "outfitPrimaryColor"),
    ]
    result: list[dict[str, Any]] = []
    definitions_root = SOURCE / "sheet_definitions"
    for prefix, pattern, slot, colors, color_field in groups:
        for path in sorted(definitions_root.glob(pattern)):
            if path.name.startswith("meta_"):
                continue
            relative = path.relative_to(definitions_root).as_posix()
            definition = load_json(path)
            if not any("teen" in layer for key, layer in definition.items() if key.startswith("layer_") and isinstance(layer, dict)):
                continue
            stem = path.stem
            for removable in ("hair_", "torso_clothes_", "legs_", "dress_"):
                if stem.startswith(removable):
                    stem = stem[len(removable):]
            semantic = stem
            result.append({
                "id": f"auto_{prefix}_{hashlib.sha1(relative.encode()).hexdigest()[:10]}",
                "slot": slot,
                "definition": relative,
                "semantic": semantic,
                "bodyTypes": ["teen"],
                "colors": colors,
                "colorField": color_field,
            })
    return result


def main() -> None:
    cfg = load_json(CONFIG)
    if cfg.get("discoverTeenCatalog"):
        known_definitions = {item["definition"] for item in cfg["items"]}
        cfg["items"].extend(item for item in discovered_teen_items() if item["definition"] not in known_definitions)
    skin = cfg["skinTones"]
    hair = cfg["hairColors"]
    manifest: dict[str, Any] = {
        "version": 1,
        "packId": "lpc",
        "frame": {"width": 64, "height": 64, "rows": 4},
        "directionRows": {"up": 0, "left": 1, "down": 2, "right": 3},
        "animations": {"idle": {"columns": 2, "frames": [0, 1], "durationMs": 500}, "walk": {"columns": 9, "frames": list(range(9)), "durationMs": 100}},
        "options": {"bodyTypes": cfg["bodyTypes"], "skinTones": skin, "hairColors": hair},
        "assets": [],
    }
    sources: dict[str, str] = {}
    credits: dict[str, Any] = {}
    seen_ids: set[str] = set()
    OUT_ASSETS.mkdir(parents=True, exist_ok=True)
    OUT_GENERATED.mkdir(parents=True, exist_ok=True)

    for item in cfg["items"]:
        definition_path = SOURCE / "sheet_definitions" / item["definition"]
        definition = load_json(definition_path)
        colors = skin if item.get("colors") == "$skin" else hair if item.get("colors") == "$hair" else item.get("colors", ["base"])
        allowed_bodies = item.get("bodyTypes", cfg["bodyTypes"])
        for layer_name, layer in sorted((k, v) for k, v in definition.items() if k.startswith("layer_")):
            for body_type in allowed_bodies:
                if body_type not in layer:
                    continue
                semantic = body_type if item["semantic"] == "$body" else item["semantic"]
                for color in colors:
                    for animation in cfg["animations"]:
                        if animation not in definition.get("animations", ["walk"]):
                            continue
                        base = SOURCE / "spritesheets" / layer[body_type]
                        try:
                            source, needs_recolor = source_for(base, animation, color)
                        except FileNotFoundError:
                            continue
                        digest = hashlib.sha1(f"{source.relative_to(SOURCE)}|{color}".encode()).hexdigest()[:12]
                        source_key = f"lpc_{digest}_{animation}"
                        destination = OUT_ASSETS / f"{source_key}.png"
                        if source_key not in sources:
                            mappings = recolor_spec(definition, color) if needs_recolor else []
                            if mappings:
                                recolor(source, destination, mappings)
                            else:
                                shutil.copy2(source, destination)
                            expected_columns = 2 if animation == "idle" else 9
                            with Image.open(destination) as generated:
                                expected_size = (expected_columns * 64, 4 * 64)
                                if generated.size != expected_size:
                                    raise ValueError(f"Dimensioni non LPC per {destination.name}: {generated.size}, attese {expected_size}")
                            sources[source_key] = f"../../../assets/character-packs/lpc/generated/{source_key}.png"
                        asset_id = f"{item['id']}:{layer_name}:{body_type}:{semantic}:{color}:{animation}"
                        if asset_id in seen_ids:
                            raise ValueError(f"Asset ID duplicato: {asset_id}")
                        seen_ids.add(asset_id)
                        attribution_id = hashlib.sha1(item["definition"].encode()).hexdigest()[:12]
                        credits.setdefault(attribution_id, {"definition": item["definition"], "credits": definition.get("credits", [])})
                        manifest["assets"].append({
                            "id": asset_id, "semanticId": semantic, "slot": item["slot"], "bodyType": body_type,
                            "color": color, "colorField": item.get("colorField"), "animation": animation,
                            "zPos": layer.get("zPos", 0), "sourceKey": source_key, "required": item.get("required", False),
                            "attributionId": attribution_id,
                        })

    manifest["assets"].sort(key=lambda a: (a["zPos"], a["id"]))
    manifest["options"]["hairStyles"] = sorted({a["semanticId"] for a in manifest["assets"] if a["slot"] == "hairFront"})
    manifest["options"]["beardStyles"] = ["none"] + sorted({a["semanticId"] for a in manifest["assets"] if a["slot"] == "beard"})
    manifest["options"]["outfits"] = sorted({a["semanticId"] for a in manifest["assets"] if a["slot"] == "outfit"})
    manifest["options"]["fullOutfits"] = sorted({a["semanticId"] for a in manifest["assets"] if a["slot"] == "fullOutfit"})
    manifest["options"]["headwear"] = ["none"] + sorted({a["semanticId"] for a in manifest["assets"] if a["slot"] == "headwear"})

    (OUT_GENERATED / "lpc-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (OUT_GENERATED / "lpc-credits.json").write_text(json.dumps(credits, indent=2) + "\n", encoding="utf-8")
    ts_lines = ["/* Generated by scripts/import_lpc_pack.py. Do not edit. */", "export const LPC_ASSET_SOURCES: Record<string, number> = {"]
    for key, rel in sorted(sources.items()):
        ts_lines.append(f'  "{key}": require("{rel}"),')
    ts_lines.append("};\n")
    (OUT_GENERATED / "lpcAssetSources.ts").write_text("\n".join(ts_lines), encoding="utf-8")
    print(f"Generated {len(manifest['assets'])} manifest entries, {len(sources)} PNGs, {len(credits)} credit groups")


if __name__ == "__main__":
    main()
