#!/usr/bin/env python3
"""Import ULPC furry cat ears + cat ears skintone for Felix, exact official source.
Both have foreground and background layers and distinct per-Felix random colors.
"""
from __future__ import annotations
from io import BytesIO
from pathlib import Path
import json,hashlib,urllib.request
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
PIN="9bf06be193b053db256b2536824af426de046aa2"
BASE=f"https://raw.githubusercontent.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator/{PIN}/"
BODY_TYPES=("male","female","teen","child","muscular","pregnant")
SPECS=(("cat_ears","head_ears_cat.json","head/ears/cat/","hair","catEarsColor",("black","chestnut","blonde","ginger")),
       ("cat_ears_skintone","head_ears_cat_skin.json","head/ears/cat/skin/","body","catEarsSkintoneColor",("light","amber","olive","brown")))
DEST=ROOT/"assets/character-packs/lpc/generated"; META=ROOT/"src/character-system/generated"
def fetch(rel):
 req=urllib.request.Request(BASE+rel,headers={"User-Agent":"MyKingdom-FelixImporter"})
 with urllib.request.urlopen(req,timeout=30) as r:return r.read()
def main():
 manifest_path=META/"lpc-manifest.json";manifest=json.loads(manifest_path.read_text(encoding="utf8"))
 src_path=META/"lpcAssetSources.ts";src_lines=src_path.read_text(encoding="utf8").splitlines()
 credits_path=META/"lpc-credits.json";credits=json.loads(credits_path.read_text(encoding="utf8"))
 manifest["assets"]=[a for a in manifest["assets"] if not a["id"].startswith("felix_cat:")]
 src_lines=[s for s in src_lines if not '"lpc_felix_cat_' in s]
 assert src_lines[-1]=="};"
 entries={};copied=0;registered_sources=set()
 for semantic,definition_name,source_dir,material,color_field,colors in SPECS:
  definition_rel="head/furry_ears/top/"+definition_name
  definition=json.loads(fetch("sheet_definitions/"+definition_rel))
  expected={"cat_ears":"Cat Ears","cat_ears_skintone":"Cat Ears Skintone"}[semantic]
  assert definition["name"]==expected
  meta=json.loads(fetch("palette_definitions/"+material+"/meta_"+material+".json"))
  palettes=json.loads(fetch(f"palette_definitions/{material}/{material}_{meta['default']}.json"))
  original_palette=palettes[meta["base"]]
  assert all(color in palettes for color in colors)
  credit_id=hashlib.sha1(definition_rel.encode()).hexdigest()[:12]
  credits[credit_id]={"definition":definition_rel,"sourceCommit":PIN,"credits":definition["credits"]}
  for body in BODY_TYPES:
   variant="child" if body=="child" else "adult"
   for layer_num,direction in [(1,"fg"),(2,"bg")]:
    z=definition["layer_"+str(layer_num)]["zPos"]
    for animation,columns in [("idle",2),("walk",9)]:
     rel=f"spritesheets/{source_dir}{variant}/{direction}/{animation}.png"
     raw=fetch(rel) if (semantic,variant,direction,animation) not in entries else None
     if raw is not None:entries[(semantic,variant,direction,animation)]=Image.open(BytesIO(raw)).convert("RGBA")
     base=entries[(semantic,variant,direction,animation)]
     assert base.size==(columns*64,256),(rel,base.size)
     for color in colors:
      source=f"lpc_felix_cat_{semantic}_{variant}_{direction}_{color}_{animation}"
      path=DEST/(source+".png")
      if not path.exists():
       image=base.copy()
       mapping={tuple(bytes.fromhex(a[1:])):tuple(bytes.fromhex(b[1:])) for a,b in zip(original_palette,palettes[color])}
       pixel=image.load()
       for y in range(image.height):
        for x in range(image.width):
         rgb=tuple(pixel[x,y][:3])
         if pixel[x,y][3] and rgb in mapping:
          nr,ng,nb=mapping[rgb];pixel[x,y]=(nr,ng,nb,pixel[x,y][3])
       path.parent.mkdir(parents=True,exist_ok=True);image.save(path,optimize=True);copied+=1
      manifest["assets"].append({"id":f"felix_cat:{semantic}:{body}:{direction}:{color}:{animation}",
       "semanticId":semantic,"slot":"ears","bodyType":body,"color":color,
       "colorField":color_field,"animation":animation,"zPos":z,"sourceKey":source,
       "required":False,"attributionId":credit_id})
      registered_sources.add(source)
 manifest["assets"].sort(key=lambda a:(a["zPos"],a["id"]))
 manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
 src_path.write_text("\n".join(src_lines[:-1] + [f'  "{source}": require("../../../assets/character-packs/lpc/generated/{source}.png"),' for source in sorted(registered_sources)] + ["};"])+"\n",encoding="utf8")
 credits_path.write_text(json.dumps(credits,indent=2,ensure_ascii=True)+"\n",encoding="utf8")
 print("Felix cat ears imported",len([x for x in manifest["assets"] if x["id"].startswith("felix_cat:")]),"manifest assets",copied,"PNG added",len(entries),"official bases")
if __name__=="__main__":main()
