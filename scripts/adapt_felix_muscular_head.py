from pathlib import Path
import json
p=Path("src/character-system/generated/lpc-manifest.json")
data=json.loads(p.read_text(encoding="utf8"))
a=data["assets"]
for original in list(a):
 if original["bodyType"]=="male" and original["slot"]=="raceFeatures" and original["semanticId"]=="human_head":
  e=dict(original)
  e["bodyType"]="muscular"
  e["id"]="felix_muscular_head:"+original["color"]+":"+original["animation"]
  if not any(v["id"]==e["id"] for v in a):
   a.append(e)
a.sort(key=lambda item:(item["zPos"],item["id"]))
p.write_text(json.dumps(data,indent=2,ensure_ascii=False)+"\n",encoding="utf8")
print("Felix muscular human head adapters:",len([v for v in a if v["id"].startswith("felix_muscular_head:")]))
