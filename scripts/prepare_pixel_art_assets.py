"""Normalize generated pixel art into deterministic Phaser-ready assets."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw


FRAME_SIZE = 64
FRAME_MARGIN = 4


def visible_bbox(image: Image.Image, threshold: int = 8) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A").point(lambda value: 255 if value > threshold else 0)
    return alpha.getbbox() or (0, 0, image.width, image.height)


def normalize_character(source: Path, destination: Path) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    source_width = image.width // 4
    source_height = image.height // 3
    frames: list[Image.Image] = []

    for row in range(3):
        for column in range(4):
            frame = image.crop((
                column * source_width,
                row * source_height,
                (column + 1) * source_width,
                (row + 1) * source_height,
            ))
            frames.append(frame.crop(visible_bbox(frame)))

    max_width = max(frame.width for frame in frames)
    max_height = max(frame.height for frame in frames)
    scale = min(
        (FRAME_SIZE - FRAME_MARGIN * 2) / max_width,
        (FRAME_SIZE - FRAME_MARGIN * 2) / max_height,
    )
    output = Image.new("RGBA", (FRAME_SIZE * len(frames), FRAME_SIZE), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        resized = frame.resize(
            (max(1, round(frame.width * scale)), max(1, round(frame.height * scale))),
            Image.Resampling.NEAREST,
        )
        x = index * FRAME_SIZE + (FRAME_SIZE - resized.width) // 2
        y = FRAME_SIZE - FRAME_MARGIN - resized.height
        output.alpha_composite(resized, (x, y))

    destination.parent.mkdir(parents=True, exist_ok=True)
    output.save(destination, optimize=True)
    return output


def normalize_building(source: Path, destination: Path) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    alpha = image.getchannel("A").point(lambda value: 255 if value >= 96 else 0)
    image.putalpha(alpha)
    image = image.crop(visible_bbox(image))
    max_side = 128
    scale = min(max_side / image.width, max_side / image.height)
    resized = image.resize(
        (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
        Image.Resampling.LANCZOS,
    )
    resized = resized.quantize(colors=48, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).convert("RGBA")
    destination.parent.mkdir(parents=True, exist_ok=True)
    resized.save(destination, optimize=True)
    return resized


def build_preview(characters: list[tuple[str, Image.Image]], buildings: list[tuple[str, Image.Image]], destination: Path) -> None:
    canvas = Image.new("RGBA", (1024, 560), (17, 24, 39, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((24, 18), "KINGDOMAPP - ORIGINAL HANDHELD PIXEL ART PACK", fill=(238, 244, 255, 255))

    y = 54
    for name, strip in characters:
        draw.text((24, y + 22), name, fill=(130, 224, 210, 255))
        canvas.alpha_composite(strip, (160, y))
        y += 92

    x = 24
    y = 270
    for name, building in buildings:
        preview = building.copy()
        preview.thumbnail((220, 220), Image.Resampling.NEAREST)
        draw.text((x, y), name, fill=(238, 244, 255, 255))
        canvas.alpha_composite(preview, (x + (220 - preview.width) // 2, y + 24 + (220 - preview.height)))
        x += 248

    destination.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(destination, quality=92)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--human", type=Path, required=True)
    parser.add_argument("--robot", type=Path, required=True)
    parser.add_argument("--command-center", type=Path, required=True)
    parser.add_argument("--dormitory", type=Path, required=True)
    parser.add_argument("--greenhouse", type=Path, required=True)
    parser.add_argument("--frontier-hut", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("assets/pixel-art"))
    args = parser.parse_args()

    characters = [
        ("Human colonist", normalize_character(args.human, args.output / "characters/human-colonist.png")),
        ("Service robot", normalize_character(args.robot, args.output / "characters/service-robot.png")),
    ]
    buildings = [
        ("Command Center", normalize_building(args.command_center, args.output / "buildings/command-center.png")),
        ("Dormitory", normalize_building(args.dormitory, args.output / "buildings/dormitory.png")),
        ("Greenhouse", normalize_building(args.greenhouse, args.output / "buildings/greenhouse.png")),
        ("Frontier Hut", normalize_building(args.frontier_hut, args.output / "buildings/frontier-hut.png")),
    ]
    build_preview(characters, buildings, args.output / "pixel-art-pack-preview.jpg")


if __name__ == "__main__":
    main()
