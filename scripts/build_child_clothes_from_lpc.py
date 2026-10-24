#!/usr/bin/env python3
"""Build child-sized LPC clothes from the tracked teen/child Universal LPC sheets.

This works without the optional upstream source pack.  Per frame, retain original
palette/pixel detail, adjust teen torso and trousers to the child body's geometry,
and reuse the native LPC child skirt for skirts.
"""
from __future__ import annotations
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / "assets/character-packs/lpc/generated"
GENERATED = ROOT / "src/character-system/generated"
MANIFEST = GENERATED / "lpc-manifest.json"
SOURCE_MODULE = GENERATED / "lpcAssetSources.ts"

SHIRT_COLORS = ["black","blue","brown","gray","green","lavender","lightblue","pink","red","white"]
PANTS_COLORS = ["black","blue","brown","darkblue","green","lightblue","maroon","red","white"]
SKIRT_COLORS = ["black","blue","darkblue","green","lavender","lightblue","maroon","pink","red","white"]
CLOSEST = {"darkblue":"navy","lightblue":"sky"}

def asset_entry(assets, body, slot, semantic, animation, color):
    entries = [a for a in assets if (a["bodyType"],a["slot"],a["semanticId"],a["animation"],a["color"]) ==
               (body,slot,semantic,animation,color)]
    if not entries:
        raise ValueError(f"Missing LPC source {body} {slot} {semantic} {animation} {color}")
    return entries[0]

def adjusted_sheet(src: Image.Image, kind: str) -> Image.Image:
    src = src.convert("RGBA")
    if src.width % 64 or src.height != 256:
        raise ValueError(f"Unexpected LPC geometry: {src.size}")
    result = Image.new("RGBA",src.size,(0,0,0,0))
    for row in range(4):
        for column in range(src.width//64):
            origin = (column*64,row*64)
            frame = src.crop((origin[0],origin[1],origin[0]+64,origin[1]+64))
            bounds = frame.getbbox()
            if bounds is None:
                continue
            cropped=frame.crop(bounds)
            if kind=="shirt":
                # The child head remains unchanged; only shoulder-to-waist is shifted.
                target_width=min(25,max(1,round(cropped.width*.94)))
                target_height=min(13,max(1,round(cropped.height*.83)))
                x=round((bounds[0]+bounds[2])/2-target_width/2)
                y=bounds[1]+4
            elif kind=="pants":
                target_width=min(22,max(1,round(cropped.width*.93)))
                target_height=min(13,max(1,round(cropped.height*.94)))
                x=round((bounds[0]+bounds[2])/2-target_width/2)
                y=bounds[1]+2
            else:
                target_width=cropped.width
                target_height=cropped.height
                x=bounds[0]
                y=bounds[1]
            resized=cropped.resize((target_width,target_height),Image.Resampling.NEAREST)
            result.paste(resized,(origin[0]+x,origin[1]+y),resized if False else None)
    return result

PALETTE={
    "black":(48,50,57), "blue":(55,91,169), "brown":(127,80,49),
    "darkblue":(31,55,103), "gray":(119,122,126), "green":(67,124,65),
    "lavender":(154,121,188), "lightblue":(107,173,207), "maroon":(124,48,68),
    "pink":(215,120,165), "red":(185,63,68), "white":(225,224,215)
}

def recolor_skirt(sheet: Image.Image,color: str) -> Image.Image:
    # Keep the LPC original transparency, dark pixel outlines and shading.
    img=sheet.convert("RGBA")
    target=PALETTE[color]
    pixels=img.load()
    for y in range(img.height):
        for x in range(img.width):
            r,g,b,a=pixels[x,y]
            if not a: continue
            brightness=(r*0.24+g*0.64+b*0.12)/255.0
            if brightness<0.13:
                # Preserved outlines.
                continue
            factor=max(.25,min(1.18,brightness/.52))
            pixels[x,y]=(min(255,int(target[0]*factor)),min(255,int(target[1]*factor)),min(255,int(target[2]*factor)),a)
    return img

def main():
    doc=json.loads(MANIFEST.read_text(encoding="utf8"))
    assets=doc["assets"]
    source_text=SOURCE_MODULE.read_text(encoding="utf8")
    definitions=[
      ("child_shirt","outfit","shirt","teen","tshirt",SHIRT_COLORS,"outfitPrimaryColor",35),
      ("child_pants","lowerBody","pants","teen","pants2",PANTS_COLORS,"outfitSecondaryColor",36),
      ("child_skirt","lowerBody","skirt","child","skirts_slit",SKIRT_COLORS,"outfitSecondaryColor",36)
    ]
    new_entries=[]
    source_lines=[]
    for semantic,slot,kind,base_body,base_semantic,colors,color_field,zpos in definitions:
        for color in colors:
            for animation in ["idle","walk"]:
                source_color=("brown" if kind=="skirt" else CLOSEST.get(color,color))
                source=asset_entry(assets,base_body,slot,base_semantic,animation,source_color)
                source_path=ASSET_ROOT/(source["sourceKey"]+".png")
                if not source_path.exists(): raise FileNotFoundError(source_path)
                new_key=f"mykingdom_{semantic}_{color}_{animation}"
                out_path=ASSET_ROOT/(new_key+".png")
                graphic=adjusted_sheet(Image.open(source_path),kind)
                if kind=="skirt": graphic=recolor_skirt(graphic,color)
                if graphic.getbbox() is None: raise ValueError(f"Empty graphics: {out_path}")
                graphic.save(out_path,optimize=True)
                new_entries.append({
                    "id":f"mykingdom:child:{semantic}:{color}:{animation}",
                    "semanticId":semantic,"slot":slot,"bodyType":"child",
                    "color":color,"colorField":color_field,"animation":animation,
                    "zPos":zpos,"sourceKey":new_key,"required":False,
                    # Derivative of original LPC assets: retain their credit ID.
                    "attributionId":source["attributionId"]
                })
                source_lines.append(f'  "{new_key}": require("../../../assets/character-packs/lpc/generated/{new_key}.png"),')
    # Replace generated entries if script re-run (deterministic and idempotent).
    existing_ids={a["id"] for a in new_entries}
    doc["assets"]=[a for a in assets if a["id"] not in existing_ids]+new_entries
    MANIFEST.write_text(json.dumps(doc,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    # Insert static Metro requires (dynamic require paths are unsupported).
    source_text="\n".join(line for line in source_text.splitlines()
                          if not any(f'"mykingdom_{name}_' in line for name in ("child_shirt","child_pants","child_skirt")))
    marker="export const LPC_ASSET_SOURCES: Record<string, number> = {\n"
    if marker not in source_text: raise ValueError("LPC sources module changed")
    source_text=source_text.replace(marker,marker+"\n".join(source_lines)+"\n",1)
    SOURCE_MODULE.write_text(source_text+"\n",encoding="utf8")
    print(f"Created {len(new_entries)} child sprite variants; preserved credits; {len(doc['assets'])} total records")

if __name__=="__main__":main()
