import React from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import type {Direction} from "../game/territoryWorldModel";

/**
 * One clearly visible circular territory switcher, fixed to the bottom of the
 * game screen. It NEVER controls the viewport camera within a 32×32 territory.
 */
export type AdjacentTerritoryStatus="owned"|"frontier"|"edge";
type Props={
  compact:boolean;
  status:Record<Direction,AdjacentTerritoryStatus>;
  onDirection:(direction:Direction)=>void;
  onOpenMap:()=>void;
};
const arrows:readonly {dir:Direction;label:string;symbol:string;x:number;y:number}[]=[
  {dir:"n",label:"Nord",symbol:"▲",x:1,y:0},
  {dir:"w",label:"Ovest",symbol:"◀",x:0,y:1},
  {dir:"e",label:"Est",symbol:"▶",x:2,y:1},
  {dir:"s",label:"Sud",symbol:"▼",x:1,y:2}
];

export function TerritoryDirectionPad({compact,status,onDirection,onOpenMap}:Props){
  const diameter=compact?108:120;
  const hit=compact?43:47;
  const centerSize=compact?35:39;
  const middle=(diameter-hit)/2;
  const edge=diameter-hit-4;
  return (
    <View testID="territory-dpad-footer" style={styles.footer}>
      <View testID="territory-dpad" accessibilityLabel="Manopola circolare per cambiare territorio"
        style={[styles.disc,{width:diameter,height:diameter,borderRadius:diameter/2}]}>
        <View pointerEvents="none" style={[styles.innerRing,{
          left:7,top:7,width:diameter-14,height:diameter-14,borderRadius:(diameter-14)/2
        }]}/>
        {arrows.map(({dir,label,symbol,x,y})=>{
          const state=status[dir],disabled=state==="edge";
          return <Pressable key={dir} testID={"territory-dpad-"+dir}
            accessibilityRole="button"
            accessibilityLabel={"Vai al territorio "+label}
            accessibilityHint={disabled?"Confine geografico non disponibile":
              state==="frontier"?"Apri acquisto o conquista del territorio confinante":
              "Visita il territorio già posseduto"}
            accessibilityState={{disabled}}
            disabled={disabled}
            onPress={()=>onDirection(dir)}
            style={({pressed})=>[styles.direction,{
              left:x===0?4:x===1?middle:edge,
              top:y===0?4:y===1?middle:edge,
              width:hit,height:hit,
              backgroundColor:pressed?"rgba(255,255,255,0.22)":"transparent"
            }]}>
            <Text style={[styles.arrow,
              state==="owned"?styles.owned:state==="frontier"?styles.frontier:styles.disabled
            ]}>{symbol}</Text>
          </Pressable>;
        })}
        <Pressable testID="territory-dpad-center" accessibilityRole="button"
          accessibilityLabel="Apri la mappa generale del regno"
          onPress={onOpenMap}
          style={({pressed})=>[styles.center,{
            left:(diameter-centerSize)/2,top:(diameter-centerSize)/2,
            width:centerSize,height:centerSize,borderRadius:centerSize/2,
            backgroundColor:pressed?"#f6e5bc":"#d6b97e"
          }]}>
          <Text style={styles.centerText}>Mappa</Text>
        </Pressable>
      </View>
    </View>
  );
}
const styles=StyleSheet.create({
  footer:{position:"absolute",bottom:5,left:0,right:0,
    alignItems:"center",justifyContent:"center",zIndex:20},
  disc:{position:"relative",backgroundColor:"#294c3d",borderWidth:3,
    borderColor:"#f0d392",overflow:"hidden",
    shadowColor:"#000",shadowOpacity:0.35,shadowRadius:8,
    shadowOffset:{width:0,height:3},elevation:8},
  innerRing:{position:"absolute",borderWidth:1,borderColor:"rgba(255,245,209,0.25)"},
  direction:{position:"absolute",alignItems:"center",justifyContent:"center",borderRadius:10},
  arrow:{fontSize:25,fontWeight:"900",textAlign:"center"},
  owned:{color:"#a9f2bf"},
  frontier:{color:"#ffe1a0"},
  disabled:{color:"#708579"},
  center:{position:"absolute",alignItems:"center",justifyContent:"center",
    borderColor:"#fff0c7",borderWidth:1.5},
  centerText:{color:"#203729",fontSize:9,fontWeight:"900"}
});