#!/usr/bin/env python3
"""Import the official ULPC Short Shorts (Walnut) into MyKingdom's LPC runtime.

Source repo/commit are pinned. Art attribution is preserved in lpc-credits.json.
Only appends this exact variant; does not regenerate unrelated sprites.
"""
from __future__ import annotations

from io import BytesIO
from pathlib import Path
import hashlib
import json
import urllib.request
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PIN = "9bf06be193b053db256b2536824af426de046aa2"
BASE = "https://raw.githubusercontent.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/" + PIN + "/"
SEMANTIC = "short_shorts"
COLOR = "walnut"
VARIANTS = {"male":"male","female":"thin","teen":"thin","child":"thin","muscular":"male","pregnant":"thin"}
OUT = ROOT / "assets/character-packs/lpc/generated"
DATA = ROOT / "src/character-system/generated"
DEFINITION = "legs/shorts/legs_shorts_short.json"
def fetch(rel: str) -> bytes:
    request = urllib.request.Request(BASE + rel, headers={"User-Agent":"MyKingdom ULPC short shorts import"})
    with urllib.request.urlopen(request, timeout=40) as response:
        return response.read()

def main():
    definition = json.loads(fetch("sheet_definitions/"+DEFINITION))
    assert definition["name"] == "Short Shorts"
    assert definition["layer_1"]["zPos"] == 20
    meta = json.loads(fetch("palette_definitions/cloth/meta_cloth.json"))
    palettes = json.loads(fetch(f"palette_definitions/cloth/cloth_{meta['default']}.json"))
    color_from, color_to = palettes[meta["base"]], palettes[COLOR]
    mapping = {tuple(bytes.fromhex(src[1:])):tuple(bytes.fromhex(dst[1:])) for src,dst in zip(color_from,color_to)}
    attrs = hashlib.sha1(DEFINITION.encode()).hexdigest()[:12]
    generated = {}
    for variant in sorted(set(VARIANTS.values())):
        for animation,columns in [("idle",2),("walk",9)]:
            relative = f"spritesheets/legs/shorts/short_shorts/{variant}/{animation}.png"
            original = fetch(relative)
            image = Image.open(BytesIO(original)).convert("RGBA")
            assert image.size == (columns*64, 4*64), (relative,image.size)
            px=image.load()
            affected=0
            for y in range(image.height):
                for x in range(image.width):
                    r,g,b,a=px[x,y]
                    if a and (r,g,b) in mapping:
                        nr,ng,nb=mapping[(r,g,b)]
                        px[x,y]=(nr,ng,nb,a)
                        affected+=1
            if not affected:raise RuntimeError(f"Color mapping matched no pixels: {relative}")
            source=f"lpc_short_shorts_walnut_{variant}_{animation}"
            path=OUT/(source+".png")
            path.parent.mkdir(parents=True,exist_ok=True)
            image.save(path, optimize=True)
            generated[(variant,animation)]=source
            print("Sprite",path.name,"pixels recolored",affected)
    manifest_path=DATA/"lpc-manifest.json"
    manifest=json.loads(manifest_path.read_text(encoding="utf8"))
    manifest["assets"]=[x for x in manifest["assets"] if not x["id"].startswith("slave_shorts_walnut:")]
    for body,variant in VARIANTS.items():
        for animation in ("idle","walk"):
            manifest["assets"].append({
               "id":f"slave_shorts_walnut:{body}:{animation}",
               "semanticId":SEMANTIC,
               "slot":"lowerBody",
               "bodyType":body,
               "color":COLOR,
               "colorField":"outfitSecondaryColor",
               "animation":animation,
               "zPos":20,
               "sourceKey":generated[(variant,animation)],
               "required":False,
               "attributionId":attrs,
            })
    manifest["assets"].sort(key=lambda x:(x["zPos"],x["id"]))
    manifest_path.write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+"\n",encoding="utf8")
    source_path=DATA/"lpcAssetSources.ts"
    lines=source_path.read_text(encoding="utf8").splitlines()
    lines=[l for l in lines if '"lpc_short_shorts_walnut_' not in l]
    assert lines[-1]=="};"
    additions=[
       f'  "{source}": require("../../../assets/character-packs/lpc/generated/{source}.png"),'
       for source in sorted(generated.values())
    ]
    lines=lines[:-1]+additions+[lines[-1]]
    source_path.write_text("\n".join(lines)+"\n",encoding="utf8")
    credit_path=DATA/"lpc-credits.json"
    credits=json.loads(credit_path.read_text(encoding="utf8"))
    credits[attrs]={"definition":DEFINITION,"sourceCommit":PIN,"credits":definition["credits"]}
    credit_path.write_text(json.dumps(credits,indent=2,ensure_ascii=True)+"\n",encoding="utf8")
    print("Done: 4 PNG, 12 manifest entries, original attribution ID",attrs)

if __name__=="__main__":
    main()
