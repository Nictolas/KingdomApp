#!/usr/bin/env python3
"""Pilot LPC: 2x pixel-art facial/body detail, preserving original silhouettes/animations.

No existing PNG is overwritten. Generates four selected male/light sheets and
a visual A/B comparison before widening coverage to other appearances.
"""
from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "src/character-system/generated/lpc-manifest.json"
INPUT = ROOT / "assets/character-packs/lpc/generated"
OUTPUT = ROOT / "assets/character-packs/lpc/hd-pilot"
FRAME = 64


def enhance_sheet(source: Image.Image, columns: int, *, face: bool) -> Image.Image:
    source = source.convert("RGBA")
    assert source.size == (FRAME * columns, FRAME * 4), source.size
    result = source.resize((source.width * 2, source.height * 2), Image.Resampling.NEAREST)
    before, after = source.load(), result.load()
    for row in range(4):
        for column in range(columns):
            ox, oy = column * FRAME, row * FRAME
            for y in range(1, FRAME - 1):
                for x in range(1, FRAME - 1):
                    px, py = ox + x, oy + y
                    red, green, blue, alpha = before[px, py]
                    if alpha < 240 or min(red, green, blue) < 32:
                        continue
                    neighbors = [before[px + dx, py + dy] for dx, dy in
                                 ((0, -1), (-1, 0), (1, 0), (0, 1))]
                    if any(p[3] < 240 for p in neighbors):
                        continue
                    if any(max(abs(p[k] - (red, green, blue)[k]) for k in range(3)) > 35 for p in neighbors):
                        continue
                    if (x + y) % (4 if face else 5):
                        continue
                    intensity = 0.12 if face else 0.09
                    def lit(value: int) -> int:
                        return min(255, round(value + (255 - value) * intensity))
                    def shade(value: int) -> int:
                        return max(0, round(value * (1 - intensity * 0.65)))
                    after[px * 2, py * 2] = (lit(red), lit(green), lit(blue), alpha)
                    after[px * 2 + 1, py * 2 + 1] = (shade(red), shade(green), shade(blue), alpha)
    return result


def selected_assets(manifest: dict) -> list[tuple[str, str, str]]:
    picks = []
    for animation in ("idle", "walk"):
        for slot, semantic in (("body", "male"), ("raceFeatures", "human_head")):
            options = [a for a in manifest["assets"] if
                       a["animation"] == animation and a["slot"] == slot
                       and a["semanticId"] == semantic and a["bodyType"] == "male"
                       and a["color"] == "light"]
            if len(options) != 1:
                raise ValueError(f"Expected one male/light {slot}/{animation}; got {len(options)}")
            picks.append((options[0]["sourceKey"], animation, slot))
    return picks


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    sheets = {}
    for key, animation, slot in selected_assets(manifest):
        columns = 2 if animation == "idle" else 9
        with Image.open(INPUT / f"{key}.png") as original:
            original = original.convert("RGBA")
            enhanced = enhance_sheet(original, columns, face=slot == "raceFeatures")
            assert enhanced.size == (FRAME * columns * 2, FRAME * 4 * 2)
            enhanced.save(OUTPUT / f"{key}.png", optimize=True)
            sheets[(slot, animation)] = original, enhanced
        print(f"{key} enhanced")

    board = Image.new("RGBA", (1024, 440), (16, 24, 40, 255))
    draw = ImageDraw.Draw(board)
    for i, animation in enumerate(("idle", "walk")):
        original = Image.new("RGBA", (64, 64))
        enhanced = Image.new("RGBA", (128, 128))
        for slot in ("body", "raceFeatures"):
            sheet, high = sheets[(slot, animation)]
            original.alpha_composite(sheet.crop((0, 128, 64, 192)))
            enhanced.alpha_composite(high.crop((0, 256, 128, 384)))
        x = i * 512
        board.alpha_composite(original.resize((192, 192), Image.Resampling.NEAREST), (x + 36, 95))
        board.alpha_composite(enhanced.resize((192, 192), Image.Resampling.NEAREST), (x + 278, 95))
        draw.text((x + 36, 48), f"{animation} - originale", fill="white")
        draw.text((x + 278, 48), f"{animation} - HD pilot 2x", fill="white")
    board.convert("RGB").save(OUTPUT / "comparison.png", optimize=True)
    print("Four alternate layered sheets and one visual comparison generated")


if __name__ == "__main__":
    main()
