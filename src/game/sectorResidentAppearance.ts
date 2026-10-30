import { aspettoPerVisualizzazioneAbitante } from "./personaggioAspetto";
import { canRenderCharacter } from "../character-system/registry";
import type { CharacterAppearance, CharacterAnimationId } from "../character-system/types";

/**
 * Human LPC citizens for both sector prototypes.
 *
 * The old demo character.png is an animal sheet and must never be used for
 * inhabitants. We reuse MyKingdom's actual layered LPC system instead.
 *
 * The identity is derived from the resident's stable ID, not their array
 * index or on-screen coordinates, so traveling, saving and moving do not
 * randomly change hair, skin, beard or clothing.
 */
const cache=new Map<string,CharacterAppearance>();
export function stableResidentAppearance(residentId:string): CharacterAppearance {
  const cached=cache.get(residentId);
  if(cached)return cached;
  let hash=2166136261;
  for(let i=0;i<residentId.length;i++){
    hash=Math.imul(hash^residentId.charCodeAt(i),16777619);
  }
  const seed=1000+((hash>>>0)%1000000000);
  const sex: "M"|"F"=(hash>>>0)%2===0?"M":"F";
  const appearance=aspettoPerVisualizzazioneAbitante({id:seed,razza:"Umano",sesso:sex})
    ?.characterAppearance;
  if(!appearance || !canRenderCharacter(appearance,"idle")){
    throw new Error("Impossibile disegnare l'abitante LPC "+residentId);
  }
  cache.set(residentId,appearance);
  return appearance;
}
export function stableResidentAnimation(residentId:string):CharacterAnimationId{
  const appearance=stableResidentAppearance(residentId);
  return canRenderCharacter(appearance,"walk")?"walk":"idle";
}
