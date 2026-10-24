#!/usr/bin/env python3
"""Rebuild single-file LPC race portraits from the runtime's own layered sprites.

Run: npx tsx scripts/preview-layers-diagnostic.ts && python scripts/build_race_portraits.py
"""
import json
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
LPC=ROOT/"assets/character-packs/lpc/generated"
OUT=ROOT/"assets/character-packs/lpc/race-portraits"
OUT.mkdir(parents=True,exist_ok=True)
records=json.loads((ROOT/"scripts/.preview-layer-sources.json").read_text(encoding="utf8"))
for race in records:
    full=Image.new("RGBA",(64,64))
    for layer in sorted(race["layers"],key=lambda l:l["zPos"]):
        sheet=Image.open(LPC/(layer["sourceId"]+".png")).convert("RGBA")
        # Static idle renderer uses frame 1 of row "down" on 2-frame sheets.
        frame=sheet.crop((64,2*64,128,3*64))
        full.alpha_composite(frame)
    # The crown, ears, hair, face and upper shirt appear inside this portrait crop.
    head=full.crop((13,2,51,43)).resize((152,164),Image.Resampling.NEAREST)
    image=Image.new("RGBA",(164,164))
    image.alpha_composite(head,(6,0))
    if image.getchannel("A").getbbox() is None: raise ValueError("Empty portrait "+race["race"])
    dst=OUT/(race["race"].lower()+".png")
    image.save(dst,optimize=True)
    print(race["race"],dst.name)
