import React from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import type {Direction} from "../game/territoryWorldModel";

/** Directional territory navigation: distinct from the camera controls. */
export type AdjacentTerritoryStatus="owned"|"frontier"|"edge";
type Props={
  compact:boolean;
  status:Record<Direction,AdjacentTerritoryStatus>;
  onDirection:(direction:Direction)=>void;
  onOpenMap:()=>void;
};
const controls:readonly {dir:Direction;label:string;symbol:string;top:number;left:number}[]=[
  {dir:"n",label:"Nord",symbol:"▲",top:0,left:1},
  {dir:"w",label:"Ovest",symbol:"◀",top:1,left:0},
  {dir:"e",label:"Est",symbol:"▶",top:1,left:2},
  {dir:"s",label:"Sud",symbol:"▼",top:2,left:1}
];

export function TerritoryDirectionPad({compact,status,onDirection,onOpenMap}:Props){
  const diameter=compact?112:124;
  const button=compact?38:42;
  const mid=(diameter-button)/2;
  const last=diameter-button-3;
  return (
    <View testID="territory-dpad-footer" style={styles.footer}>
      <View testID="territory-dpad" accessibilityLabel="Manopola per cambiare riquadro"
        style={[styles.disc,{width:diameter,height:diameter,borderRadius:diameter/2}]}>
        {controls.map(({dir,label,symbol,top,left})=>{
          const state=status[dir];
          const disabled=state==="edge";
          const x=left===0?3:left===1?mid:last;
          const y=top===0?3:top===1?mid:last;
          return <Pressable key={dir} testID={"territory-dpad-"+dir}
            accessibilityRole="button"
            accessibilityLabel={"Vai al territorio "+label}
            accessibilityHint={disabled?"Limite geografico raggiunto":state==="frontier"?
              "Apri acquisto o conquista del territorio confinante":"Visita subito il territorio posseduto"}
            accessibilityState={{disabled}}
            disabled={disabled}
            onPress={()=>onDirection(dir)}
            style={[styles.direction,{left:x,top:y,width:button,height:button,borderRadius:button/2},
              state==="owned"&&styles.owned,
              state==="frontier"&&styles.frontier,
              disabled&&styles.disabled]}>
            <Text style={styles.arrow}>{symbol}</Text>
          </Pressable>;
        })}
        <Pressable testID="territory-dpad-center" accessibilityRole="button"
          accessibilityLabel="Apri la mappa generale del regno"
          onPress={onOpenMap}
          style={[styles.center,{left:mid,top:mid,width:button,height:button,borderRadius:button/2}]}>
          <Text style={styles.centerText}>Mappa</Text>
        </Pressable>
      </View>
      <Text style={styles.caption}>Cambia territorio</Text>
    </View>
  );
}
const styles=StyleSheet.create({
  footer:{alignItems:"center",justifyContent:"center",paddingTop:2,paddingBottom:2,gap:1},
  disc:{backgroundColor:"#1a382e",borderColor:"#b69d6e",borderWidth:2,
    position:"relative",alignItems:"center",justifyContent:"center"},
  direction:{position:"absolute",backgroundColor:"#355b47",borderWidth:1,
    borderColor:"#92af93",justifyContent:"center",alignItems:"center"},
  owned:{backgroundColor:"#28734c",borderColor:"#a7e7a9"},
  frontier:{backgroundColor:"#7a633a",borderColor:"#edce88"},
  disabled:{opacity:0.22},
  arrow:{color:"#fff7de",fontSize:21,fontWeight:"900",textAlign:"center"},
  center:{position:"absolute",backgroundColor:"#d2b578",borderColor:"#f5e2a4",
    borderWidth:1,alignItems:"center",justifyContent:"center"},
  centerText:{color:"#253528",fontSize:9,fontWeight:"900"},
  caption:{color:"#e7dab9",fontSize:10,fontWeight:"700",textAlign:"center"}
});