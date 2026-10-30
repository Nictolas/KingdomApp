import type { CharacterAppearance } from "../character-system/types";
import { canRenderCharacter, compatibleCatalogOptions, compatibleColorsForField, firstCompatibleColorForField } from "../character-system/registry";
import { normalizeCharacterAppearance } from "../character-system/appearance";

/**
 * A profession is identified by a stable ID; residents keep their own faces,
 * skin, hair, beards, ages and body types. Only garments/accessories are shared.
 */
export const PROFESSION_ROLES = [
  { id: "agricoltore", label: "Contadino", lavoro: "Agricoltore", bodyType: "male" },
  { id: "taglialegna", label: "Taglialegna", lavoro: "Taglialegna", bodyType: "male" },
  { id: "minatore", label: "Minatore", lavoro: "Minatore", bodyType: "male" },
  { id: "fabbro", label: "Fabbro", lavoro: "Fabbro", bodyType: "male" },
  { id: "guardia", label: "Guardia", lavoro: "Guardia", bodyType: "teen" },
  { id: "mercante", label: "Mercante", lavoro: "Mercante", bodyType: "male" },
  { id: "artigiano", label: "Artigiano", lavoro: "Artigiano", bodyType: "male" },
  { id: "edile", label: "Edile", lavoro: "Edile", bodyType: "male" },
  { id: "sacerdote", label: "Sacerdote", lavoro: "Sacerdote", bodyType: "male" },
  { id: "medico", label: "Medico", lavoro: "Medico", bodyType: "teen" },
  { id: "giudice", label: "Giudice", lavoro: "Giudice", bodyType: "teen" },
  { id: "mago", label: "Mago", lavoro: "Mago", bodyType: "teen" },
  { id: "consigliere", label: "Consigliere", lavoro: "Consigliere", bodyType: "male" },
  { id: "nobile", label: "Nobile", lavoro: "Nobile", bodyType: "male" },
  { id: "re", label: "Re", lavoro: "Re", bodyType: "teen" }
] as const;
export type ProfessionRoleId = (typeof PROFESSION_ROLES)[number]["id"];

export const PROFESSION_OUTFITS_KEY = "mykingdom:profession-outfits:v1";
const GARMENT_FIELDS = [
  "outfit","upperOutfit","lowerOutfit","fullOutfit","fullOutfitTrim",
  "outfitPrimaryColor","outfitSecondaryColor","footwear","footwearColor",
  "headwear","headwearColor","cape","capeTrim","capeColor",
  "accessory","neckwear","neckwearColor"
] as const satisfies readonly (keyof CharacterAppearance)[];

export type ProfessionUniform = Pick<CharacterAppearance,(typeof GARMENT_FIELDS)[number]>;
export type ProfessionUniforms = Partial<Record<ProfessionRoleId,ProfessionUniform>>;
export type ProfessionUniformStorage = {
  getItem(key:string):Promise<string|null>;
  setItem(key:string,value:string):Promise<void>;
};

let activeUniforms: ProfessionUniforms = {};
const record = (x: unknown): x is Record<string,unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

export function extractProfessionUniform(appearance: CharacterAppearance): ProfessionUniform {
  return Object.fromEntries(GARMENT_FIELDS.map(field=>[field,appearance[field]])) as ProfessionUniform;
}
function validUniform(value:unknown): value is ProfessionUniform {
  return record(value) &&
    Object.keys(value).length === GARMENT_FIELDS.length &&
    GARMENT_FIELDS.every(key=>typeof value[key]==="string" &&
      (value[key] as string).length>0 && (value[key] as string).length<=80);
}
export function parseProfessionUniforms(raw: string): ProfessionUniforms {
  const input:unknown=JSON.parse(raw);
  if(!record(input)||input.version!==1||!record(input.uniforms))throw new Error("Formato divise non valido");
  if(Object.keys(input).some(k=>k!=="version"&&k!=="uniforms"))throw new Error("Campi sconosciuti");
  const result: ProfessionUniforms = {};
  const allowed=new Set<string>(PROFESSION_ROLES.map(r=>r.id));
  for(const [id,uniform] of Object.entries(input.uniforms)){
    if(!allowed.has(id)||!validUniform(uniform))throw new Error("Divisa non valida: "+id);
    result[id as ProfessionRoleId]={...uniform} as ProfessionUniform;
  }
  return result;
}
export function getProfessionUniforms(): ProfessionUniforms {return {...activeUniforms};}
export function resetProfessionUniformCacheForTests(): void {activeUniforms={};}

export async function loadProfessionUniforms(storage: ProfessionUniformStorage): Promise<ProfessionUniforms> {
  const raw=await storage.getItem(PROFESSION_OUTFITS_KEY);
  const parsed=raw==null?{}:parseProfessionUniforms(raw);
  activeUniforms=parsed;
  return {...parsed};
}
export async function saveProfessionUniforms(
  storage:ProfessionUniformStorage,
  uniforms:ProfessionUniforms
):Promise<void>{
  // Copy/validate before any write. The editor does not touch game saves.
  const serialized=JSON.stringify({version:1,uniforms});
  const verified=parseProfessionUniforms(serialized);
  await storage.setItem(PROFESSION_OUTFITS_KEY,serialized);
  activeUniforms=verified;
}
export async function saveProfessionUniform(
  storage:ProfessionUniformStorage,id:ProfessionRoleId,uniform:ProfessionUniform
):Promise<void>{
  await saveProfessionUniforms(storage,{...activeUniforms,[id]:uniform});
}
export async function clearProfessionUniform(storage:ProfessionUniformStorage,id:ProfessionRoleId):Promise<void>{
  const next={...activeUniforms};
  delete next[id];
  await saveProfessionUniforms(storage,next);
}

const workId=(work:string|undefined|null,isKing:boolean):ProfessionRoleId|null=>{
  if(isKing)return "re";
  const v=(work??"").trim().toLocaleLowerCase("it");
  if(!v)return null;
  if(v==="re"||v==="regina")return "re";
  if(v.includes("agricolt")||v.includes("contadin"))return "agricoltore";
  if(v.includes("taglialegn")||v.includes("boscaiol"))return "taglialegna";
  if(v.includes("minator"))return "minatore";
  if(v.includes("fabbro")||v.includes("fabbri"))return "fabbro";
  if(v.includes("guard")||v.includes("soldat"))return "guardia";
  if(v.includes("mercant")||v.includes("commerc")||v.includes("negoz"))return "mercante";
  if(v.includes("artigian"))return "artigiano";
  if(v.includes("edil")||v.includes("murator"))return "edile";
  if(v.includes("sacerd")||v.includes("religios")||v.includes("prete"))return "sacerdote";
  if(v.includes("medic"))return "medico";
  if(v.includes("giudic"))return "giudice";
  if(v.includes("mago")||v.includes("maga"))return "mago";
  if(v.includes("consigli"))return "consigliere";
  if(v.includes("nobil"))return "nobile";
  return null;
};
export function professionRoleForWork(work:string|null|undefined,isKing=false):ProfessionRoleId|null{
  return workId(work,isKing);
}

/** Resolve each garment against the actual LPC catalog of this resident's body. */
export function applyProfessionUniform(
  base:CharacterAppearance,
  work:string|null|undefined,
  options:{isKing?:boolean; nudismoAttivo?:boolean; override?:ProfessionUniform|null}={}
):CharacterAppearance{
  if(options.nudismoAttivo)return base;
  const id=workId(work,options.isKing===true);
  const uniform=options.override===undefined?(id?activeUniforms[id]:undefined):options.override;
  if(!uniform)return base;
  const catalog=compatibleCatalogOptions(base,{allowRoyalHeadwear:options.isKing===true});
  const patch:Partial<CharacterAppearance>={};
  if(uniform.fullOutfit==="none"||catalog.fullOutfits.includes(uniform.fullOutfit)){
    patch.fullOutfit=uniform.fullOutfit;
    patch.fullOutfitTrim=uniform.fullOutfit==="none"?"none":uniform.fullOutfitTrim;
  }
  if(uniform.upperOutfit==="none"||catalog.upperOutfits.includes(uniform.upperOutfit)){
    patch.upperOutfit=uniform.upperOutfit;
    patch.outfit=uniform.outfit;
  }
  if(uniform.lowerOutfit==="none"||catalog.lowerOutfits.includes(uniform.lowerOutfit))patch.lowerOutfit=uniform.lowerOutfit;
  if(uniform.footwear==="none"||catalog.footwear.includes(uniform.footwear)){
    patch.footwear=uniform.footwear;
    patch.footwearColor=uniform.footwearColor;
  }
  if(uniform.headwear==="none"||catalog.headwear.includes(uniform.headwear)){
    patch.headwear=uniform.headwear;
    patch.headwearColor=uniform.headwearColor;
  }
  if(uniform.cape==="none"||catalog.capes.includes(uniform.cape)){
    patch.cape=uniform.cape;
    patch.capeTrim=uniform.capeTrim;
    patch.capeColor=uniform.capeColor;
  }
  patch.accessory=uniform.accessory;
  patch.neckwear=uniform.neckwear;
  patch.neckwearColor=uniform.neckwearColor;

  const upper=patch.upperOutfit ?? base.upperOutfit;
  const lower=patch.lowerOutfit ?? base.lowerOutfit;
  const full=patch.fullOutfit ?? base.fullOutfit;
  const slot=full!=="none"?"fullOutfit":"outfit";
  const semantic=full!=="none"?full:upper;
  const upperColors=compatibleColorsForField(base,"outfitPrimaryColor",slot,semantic);
  const lowerColors=compatibleColorsForField(base,"outfitSecondaryColor","lowerBody",lower);
  patch.outfitPrimaryColor=upperColors.includes(uniform.outfitPrimaryColor)
    ? uniform.outfitPrimaryColor
    : firstCompatibleColorForField(base,"outfitPrimaryColor",slot,semantic);
  patch.outfitSecondaryColor=lowerColors.includes(uniform.outfitSecondaryColor)
    ? uniform.outfitSecondaryColor
    : firstCompatibleColorForField(base,"outfitSecondaryColor","lowerBody",lower);
  const candidate=normalizeCharacterAppearance({...base,...patch});
  // Never change a resident's physical appearance as a side effect of changing a uniform.
  if(!canRenderCharacter(candidate,"idle"))return base;
  return candidate;
}
