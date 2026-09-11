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
    variant = base / animation / f"{color}.png"
    if variant.exists():
        return variant, False
    direct = base / f"{animation}.png"
    if direct.exists():
        return direct, color != "base"
    fallback = base / animation / "white.png"
    if fallback.exists():
        return fallback, color != "base"
    raise FileNotFoundError(f"Nessun PNG per {base.relative_to(SOURCE)} {animation} {color}")


def write_animation_sheet(source: Path, destination: Path, animation: str, mappings: list[tuple[list[str], list[str]]], *, derive_idle_from_walk: bool) -> None:
    """Copia (e eventualmente ricolora) lo sheet; se serve idle e c'è solo walk, ritaglia le prime 2 colonne."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    if mappings:
        recolor(source, destination, mappings)
        working = destination
    else:
        working = source
    image = Image.open(working).convert("RGBA")
    if derive_idle_from_walk:
        # Walk ULPC: 9×64; idle: 2×64. Usiamo le prime due colonne del walk.
        if image.size[0] < 128 or image.size[1] != 256:
            raise ValueError(f"Walk non valido per derivare idle: {source} {image.size}")
        image = image.crop((0, 0, 128, 256))
    expected_columns = 2 if animation == "idle" else 9
    expected_size = (expected_columns * 64, 4 * 64)
    if image.size != expected_size:
        raise ValueError(f"Dimensioni non LPC per {destination.name}: {image.size}, attese {expected_size}")
    image.save(destination, optimize=True)


def colors_for_definition(definition: dict[str, Any]) -> list[str]:
    variants = definition.get("variants")
    if variants:
        return list(variants)
    recolors = definition.get("recolors")
    if recolors and recolors.get("material"):
        material = recolors["material"]
        meta = load_json(SOURCE / f"palette_definitions/{material}/meta_{material}.json")
        palette_names = recolors.get("palettes") or [meta["default"]]
        palettes = load_json(SOURCE / f"palette_definitions/{material}/{material}_{palette_names[0]}.json")
        return ["base", *sorted(palettes.keys())]
    return ["base"]


def discovered_headwear_items(body_type: str) -> list[dict[str, Any]]:
    """Cappelli e copricapi LPC (esclude accessori facciali e collo)."""
    result: list[dict[str, Any]] = []
    definitions_root = SOURCE / "sheet_definitions"
    for path in sorted(definitions_root.glob("headwear/**/*.json")):
        relative = path.relative_to(definitions_root).as_posix()
        if relative.startswith("headwear/accessories/") or relative.startswith("headwear/neck/"):
            continue
        definition = load_json(path)
        if not any(
            body_type in layer
            for key, layer in definition.items()
            if key.startswith("layer_") and isinstance(layer, dict)
        ):
            continue
        stem = path.stem
        semantic = stem[4:] if stem.startswith("hat_") else stem
        result.append({
            "id": f"auto_headwear_{body_type}_{hashlib.sha1(relative.encode()).hexdigest()[:10]}",
            "slot": "headwear",
            "definition": relative,
            "semantic": semantic,
            "bodyTypes": [body_type],
            "colors": colors_for_definition(definition),
            "colorField": "headwearColor",
        })
    return result


def discovered_body_type_items(body_type: str) -> list[dict[str, Any]]:
    """Indicizza automaticamente gli elementi LPC compatibili con un body type."""
    groups = [
        ("hair", "hair/**/hair_*.json", "hairFront", "$hair", "hairColor"),
        ("upper", "torso/shirts/**/*.json", "outfit", "$definition", "outfitPrimaryColor"),
        ("lower_pants", "legs/pants/**/*.json", "lowerBody", "$definition", "outfitSecondaryColor"),
        ("lower_skirts", "legs/skirts/**/*.json", "lowerBody", "$definition", "outfitSecondaryColor"),
        ("full", "torso/dresses/**/*.json", "fullOutfit", "$definition", "outfitPrimaryColor"),
        ("feet", "feet/**/*.json", "footwear", "$definition", "footwear"),
        ("cape", "torso/cape/**/*.json", "cape", "$definition", "capeColor"),
    ]
    result: list[dict[str, Any]] = []
    definitions_root = SOURCE / "sheet_definitions"
    for prefix, pattern, slot, colors, color_field in groups:
        for path in sorted(definitions_root.glob(pattern)):
            if path.name.startswith("meta_"):
                continue
            relative = path.relative_to(definitions_root).as_posix()
            definition = load_json(path)
            if not any(
                body_type in layer
                for key, layer in definition.items()
                if key.startswith("layer_") and isinstance(layer, dict)
            ):
                continue
            stem = path.stem
            for removable in ("hair_", "torso_clothes_", "legs_", "dress_", "cape_"):
                if stem.startswith(removable):
                    stem = stem[len(removable):]
            semantic = stem
            item_colors = colors if colors != "$definition" else colors_for_definition(definition)
            result.append({
                "id": f"auto_{prefix}_{body_type}_{hashlib.sha1(relative.encode()).hexdigest()[:10]}",
                "slot": slot,
                "definition": relative,
                "semantic": semantic,
                "bodyTypes": [body_type],
                "colors": item_colors,
                "colorField": color_field,
            })
    return result


def discovered_teen_items() -> list[dict[str, Any]]:
    return [*discovered_body_type_items("teen"), *discovered_headwear_items("teen")]


def main() -> None:
    cfg = load_json(CONFIG)
    if cfg.get("discoverTeenCatalog"):
        known_definitions = {item["definition"] for item in cfg["items"]}
        cfg["items"].extend(item for item in discovered_teen_items() if item["definition"] not in known_definitions)
    if cfg.get("discoverPregnantCatalog"):
        known_definitions = {item["definition"] for item in cfg["items"]}
        cfg["items"].extend(item for item in discovered_body_type_items("pregnant") if item["definition"] not in known_definitions)
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
        colors = (
            skin if item.get("colors") == "$skin"
            else hair if item.get("colors") == "$hair"
            else item.get("colors") or colors_for_definition(definition)
        )
        allowed_bodies = item.get("bodyTypes", cfg["bodyTypes"])
        layer_key_map = item.get("layerKeyMap", {})
        definition_animations = set(definition.get("animations", ["walk"]))
        for layer_name, layer in sorted((k, v) for k, v in definition.items() if k.startswith("layer_")):
            for body_type in allowed_bodies:
                layer_key = layer_key_map.get(body_type, body_type)
                if layer_key not in layer:
                    continue
                semantic = body_type if item["semantic"] == "$body" else item["semantic"]
                for color in colors:
                    for animation in cfg["animations"]:
                        derive_idle_from_walk = False
                        source_animation = animation
                        if animation not in definition_animations:
                            # Child clothes ecc. espongono solo walk: deriva idle dalle prime 2 colonne.
                            if animation == "idle" and "walk" in definition_animations:
                                source_animation = "walk"
                                derive_idle_from_walk = True
                            else:
                                continue
                        base = SOURCE / "spritesheets" / layer[layer_key]
                        try:
                            source, needs_recolor = source_for(base, source_animation, color)
                        except FileNotFoundError:
                            continue
                        digest_src = f"{source.relative_to(SOURCE)}|{color}|{animation}|idle_from_walk={derive_idle_from_walk}"
                        digest = hashlib.sha1(digest_src.encode()).hexdigest()[:12]
                        source_key = f"lpc_{digest}_{animation}"
                        destination = OUT_ASSETS / f"{source_key}.png"
                        if source_key not in sources:
                            mappings = recolor_spec(definition, color) if needs_recolor else []
                            write_animation_sheet(
                                source,
                                destination,
                                animation,
                                mappings,
                                derive_idle_from_walk=derive_idle_from_walk,
                            )
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
    manifest["options"]["footwear"] = sorted({a["semanticId"] for a in manifest["assets"] if a["slot"] == "footwear"})
    manifest["options"]["capes"] = sorted({a["semanticId"] for a in manifest["assets"] if a["slot"] == "cape"})
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
