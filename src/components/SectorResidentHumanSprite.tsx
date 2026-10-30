import React,{memo,useMemo} from "react";
import { View } from "react-native";
import { SpriteCharacterRenderer } from "./SpriteCharacterRenderer";
import {
  stableResidentAnimation,stableResidentAppearance
} from "../game/sectorResidentAppearance";

/**
 * One real LPC human, rooted at one logical tile. The visible head/hat may
 * extend above this tile (1.22×) without changing occupancy/pathfinding.
 * The frame comes from the ONE world clock, not per-character timers.
 */
export const SectorResidentHumanSprite=memo(function SectorResidentHumanSprite({
  cell,residentId,frame
}:{cell:number;residentId:string;frame:number}){
  const appearance=useMemo(()=>stableResidentAppearance(residentId),[residentId]);
  const animation=useMemo(()=>stableResidentAnimation(residentId),[residentId]);
  const size=Math.max(1,Math.round(cell*1.22));
  return (
    <View testID="resident-human-lpc" pointerEvents="none"
      style={{width:cell,height:cell,position:"relative",overflow:"visible"}}>
      <View pointerEvents="none" style={{
        position:"absolute",left:(cell-size)/2,top:cell-size,
        width:size,height:size,overflow:"hidden"
      }}>
        <SpriteCharacterRenderer appearance={appearance} animation={animation}
          direction="down" size={size} animate={false} frameOverride={frame}/>
      </View>
    </View>
  );
});
