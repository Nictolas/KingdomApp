import React, { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  generateSectorPreviewWorld, measureSectorPreviewViewport, hitTestSectorPreview, isRoadCell, neighborSector, SECTOR_IDS,
  cycleSectorPreviewEntity, sectorPreviewSelectionInfo, type SectorBuilding, type SectorId, type SectorPreviewHit, type SectorPreview
} from "../src/game/sectorPreviewModel";

// A read-only fixture, intentionally separate from the real GameContext and save pipeline.
const CASTLE_ART = require("../assets/pixel-art/buildings/castle.png");
const HOUSE_ART = require("../assets/tilesets/DEMO-vector-rpg-overworld-tileset/house_1.png");
const HUT_ART = require("../assets/tilesets/DEMO-vector-rpg-overworld-tileset/house_2.png");
const TREE_ART = require("../assets/tilesets/DEMO-vector-rpg-overworld-tileset/tree_1.png");
const SHIRT_COLORS = ["#aa5749","#6086a3","#8f8c55","#86679d","#527d69"] as const;
const MAP_ORDER: Array<SectorId | null> = [null,"nord",null,"ovest","centro","est",null,"sud",null];
const LABELS: Record<SectorId, string> = {centro:"♛",nord:"N",sud:"S",est:"E",ovest:"O"};
type Picked = { id: string; name: string; detail: string } | null;
function selectionDetail(hit: SectorPreviewHit | null, preview: SectorPreview): Picked {
  if (!hit) return null;
  const info = sectorPreviewSelectionInfo(preview, hit.id);
  const position = info ? ` · casella ${info.x + 1},${info.y + 1} · ${info.index}/${info.total}` : "";
  return {id:hit.id,name:hit.name,detail:(hit.kind === "resident" ? "Abitante" : "Edificio") + " · " + preview.label + position};
}

function buildingAsset(building: SectorBuilding) {
  if (building.kind === "castle") return CASTLE_ART;
  if (building.kind === "hut" || building.kind === "farm") return HUT_ART;
  return HOUSE_ART;
}

export default function SettoriPreviewScreen() {
  const [sector, setSector] = useState<SectorId>("centro");
  const [picked, setPicked] = useState<Picked>(null);
  const [mapArea, setMapArea] = useState({width:0,height:0});
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
  const landscape = windowWidth > windowHeight;
  const tight = windowWidth < 380 || windowHeight < 700;
  const cols = 16, rows = 24;
  const world = useMemo(() => generateSectorPreviewWorld(), []);
  const preview = world[sector];
  const visibleCount = preview.residents.length;
  const worldPopulation = SECTOR_IDS.reduce((sum,id)=>sum + world[id].residents.length,0);
  const viewport = measureSectorPreviewViewport(mapArea.width,mapArea.height);
  const cell = viewport.cell;
  const touchHint = viewport.legibility === "unavailable" ? "Spazio insufficiente per mostrare la mappa."
    : viewport.legibility === "tiny" ? "Caselle minuscole: usa ‹ ›; meglio in verticale."
    : viewport.legibility === "compact" ? "Caselle piccole: usa ‹ › per selezionare."
    : "Tocca un edificio o un abitante.";
  const terrain = useMemo(() => Array.from({length:cols*rows},(_,i)=>{
    const x=i%cols,y=Math.floor(i/cols);
    const road=isRoadCell(x,y,cols,rows);
    const grass=(x*17+y*23)%4;
    return {x,y,road,color:road ? (grass===0?"#bab19a":"#b1a68f") : (["#65985b","#639356","#6b9b61","#5c8e55"][grass])};
  }),[cols,rows]);
  const trees = useMemo(()=>{
    const occupiedResidents=new Set(preview.residents.map(p=>p.y*cols+p.x));
    return terrain.filter(t=> !t.road && !preview.occupied.has(t.y*cols+t.x)
      && !occupiedResidents.has(t.y*cols+t.x)
      && ((t.x*31+t.y*47+(sector==="nord"?5:19))%(sector==="nord"?7:23)===0));
  },[terrain,preview,cols,sector]);

  const switchSector = (next: SectorId | null) => {
    if (!next || next===sector) return;
    setSector(next);setPicked(null);
  };
  const navigate = (dir: "n" | "s" | "e" | "w") => switchSector(neighborSector(sector,dir));
  const cyclePicked = (step: -1 | 1) => setPicked(current =>
    selectionDetail(cycleSectorPreviewEntity(preview,current?.id ?? null,step),preview));

  return (
    <SafeAreaView style={styles.root} edges={["top","bottom"]}>
      <View style={[styles.header,tight&&styles.headerTight,landscape&&styles.headerLandscape]}>
        <View style={{flexShrink:1}}><Text numberOfLines={1} style={[styles.appName,landscape&&styles.appNameLandscape]}>♛ MyKingdom</Text>{!landscape && <Text numberOfLines={1} style={styles.subtitle}>CAMPIONE · MAPPA A SETTORI FISSI</Text>}</View>
        {windowWidth >= 360 && !landscape && <View style={styles.rightHeader}>
          <Text style={styles.population}>{worldPopulation} abitanti</Text>
          <Text style={styles.subtitle}>Regno dimostrativo</Text>
        </View>}
      </View>
      <View style={[styles.zoneHeader,tight&&styles.zoneHeaderTight,landscape&&styles.zoneHeaderLandscape]}>
        <Text style={styles.zoneTitle}>{preview.label.toLocaleUpperCase("it-IT")}</Text>
        <Text numberOfLines={1} style={styles.zoneSummary}>{cols}×{rows} · {preview.buildings.length} edifici · {visibleCount} abitanti</Text>
      </View>
      <View style={styles.mapArea} onLayout={event=>{
        const {width,height}=event.nativeEvent.layout;
        setMapArea(old=>old.width===width&&old.height===height?old:{width,height});
      }}>
        {cell>0 ? (
          <View style={[styles.mapGrid,{width:cols*cell,height:rows*cell}]}>
            {terrain.map((t,i)=>(
              <View key={i} pointerEvents="none" style={{
                position:"absolute",left:t.x*cell,top:t.y*cell,
                width:cell,height:cell,backgroundColor:t.color,
                borderWidth:StyleSheet.hairlineWidth,borderColor:"#2c523a22"
              }}>
                {t.road ? <View style={{position:"absolute",left:cell*.19,top:cell*.22,width:cell*.31,height:cell*.08,backgroundColor:"#a19780"}}/> : null}
              </View>
            ))}
            <Pressable accessibilityRole="button" accessibilityLabel="Mappa a caselle: tocca per selezionare"
              accessibilityHint="Con lettore schermo usa le azioni incrementa e decrementa per scorrere edifici e abitanti."
              accessibilityActions={[{name:"increment",label:"Elemento successivo"},{name:"decrement",label:"Elemento precedente"}]}
              onAccessibilityAction={event=>{
                if(event.nativeEvent.actionName==="increment") cyclePicked(1);
                if(event.nativeEvent.actionName==="decrement") cyclePicked(-1);
              }}
              onPress={event=>setPicked(selectionDetail(
                hitTestSectorPreview(preview,event.nativeEvent.locationX,event.nativeEvent.locationY,cell),preview))}
              style={[StyleSheet.absoluteFill,{zIndex:1}]} />
            {trees.map(t=>(
              <View key={"tree-"+t.x+"-"+t.y} pointerEvents="none"
                style={{position:"absolute",left:t.x*cell,top:t.y*cell,width:cell,height:cell}}>
                <Image source={TREE_ART} style={{width:"100%",height:"100%"}} resizeMode="contain"/>
              </View>
            ))}
            {preview.buildings.map(b=>(
              <Pressable key={b.id}
                accessibilityRole="button" accessibilityLabel={"Seleziona "+b.name}
                onPress={()=>setPicked(selectionDetail({id:b.id,name:b.name,kind:"building"},preview))}
                accessibilityState={{selected:picked?.id===b.id}}
                style={[styles.entity,{left:b.x*cell,top:b.y*cell,width:b.w*cell,height:b.h*cell,zIndex:2},
                  picked?.id===b.id&&styles.selected]}>
                <Image source={buildingAsset(b)} resizeMode="contain" style={{width:"100%",height:"100%"}}/>
              </Pressable>
            ))}
            {preview.residents.map((p,i)=>(
              <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={"Seleziona "+p.name}
                onPress={()=>setPicked(selectionDetail({id:p.id,name:p.name,kind:"resident"},preview))}
                accessibilityState={{selected:picked?.id===p.id}}
                hitSlop={3}
                style={[styles.resident,{left:p.x*cell,top:p.y*cell,width:cell,height:cell,zIndex:3},
                  picked?.id===p.id&&styles.selected]}>
                <View style={{width:Math.max(5,cell*.38),height:Math.max(5,cell*.35),backgroundColor:i%4===0?"#c38c61":"#e1b18c",borderTopLeftRadius:3,borderTopRightRadius:3,
                  borderTopWidth:Math.max(2,cell*.09),borderTopColor:i%3===0?"#493b33":"#7d603f"}}/>
                <View style={{width:Math.max(6,cell*.5),height:Math.max(6,cell*.34),backgroundColor:SHIRT_COLORS[i%SHIRT_COLORS.length],borderRadius:2}}/>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <Pressable accessibilityRole="button" accessibilityLabel="Settore nord"
            disabled={!neighborSector(sector,"n")} onPress={()=>navigate("n")}
            style={[styles.arrow,styles.north,!neighborSector(sector,"n")&&styles.disabled]}>
            <Text style={styles.arrowText}>↑</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Settore sud"
            disabled={!neighborSector(sector,"s")} onPress={()=>navigate("s")}
            style={[styles.arrow,styles.south,!neighborSector(sector,"s")&&styles.disabled]}>
            <Text style={styles.arrowText}>↓</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Settore ovest"
            disabled={!neighborSector(sector,"w")} onPress={()=>navigate("w")}
            style={[styles.arrow,styles.west,!neighborSector(sector,"w")&&styles.disabled]}>
            <Text style={styles.arrowText}>←</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Settore est"
            disabled={!neighborSector(sector,"e")} onPress={()=>navigate("e")}
            style={[styles.arrow,styles.east,!neighborSector(sector,"e")&&styles.disabled]}>
            <Text style={styles.arrowText}>→</Text>
          </Pressable>
        </View>
      </View>
      <View style={[styles.footer,tight&&styles.footerTight,landscape&&styles.footerLandscape]}>
        <View style={[styles.miniMap,landscape&&styles.miniMapLandscape]}>
          {MAP_ORDER.map((id,index)=>id
            ? <Pressable key={id} accessibilityRole="button" accessibilityLabel={"Vai a "+world[id].label}
                onPress={()=>switchSector(id)}
                accessibilityState={{selected:id===sector}}
                style={[styles.miniCell,landscape&&styles.miniCellLandscape,id===sector&&styles.miniCellActive]}>
                <Text style={[styles.miniText,landscape&&styles.miniTextLandscape,id===sector&&styles.miniTextActive]}>{LABELS[id]}</Text>
              </Pressable>
            : <View key={index} style={[styles.miniPlaceholder,landscape&&styles.miniCellLandscape]}/>)}
        </View>
        <View style={styles.details} accessibilityLiveRegion="polite">
          <Text numberOfLines={1} style={styles.detailName}>{picked?.name ?? preview.label}</Text>
          <Text numberOfLines={landscape?1:2} style={styles.detailBody}>{picked?.detail ?? touchHint}</Text>
          {!landscape && <Text style={styles.detailCount}>Visibili {visibleCount} di {worldPopulation} abitanti</Text>}
        </View>
        <View style={styles.selectionButtons}>
          <Pressable accessibilityRole="button" accessibilityLabel="Elemento precedente" accessibilityHint="Seleziona l'edificio o abitante precedente nel settore" onPress={()=>cyclePicked(-1)} style={styles.selectButton}>
            <Text style={styles.selectText}>‹</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Elemento successivo" accessibilityHint="Seleziona l'edificio o abitante successivo nel settore" onPress={()=>cyclePicked(1)} style={styles.selectButton}>
            <Text style={styles.selectText}>›</Text>
          </Pressable>
        </View>
        {!tight && windowWidth>=540 && <View style={styles.controls} accessible accessibilityLabel="Anteprima statica, griglia fissa 16 per 24">
          <Text style={styles.controlLabel}>16×24 fisso</Text>
          <Text style={styles.controlNote}>STATICO</Text>
        </View>}
      </View>
      {!landscape && <Text style={styles.disclaimer}>Campione statico: nessuna simulazione o modifica ai salvataggi.</Text>}
    </SafeAreaView>
  );
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:"#10211e"},
  header:{minHeight:60,flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:13,backgroundColor:"#182831",borderBottomColor:"#7c5c37",borderBottomWidth:2},
  headerTight:{minHeight:46,paddingHorizontal:9},
  headerLandscape:{minHeight:34,paddingHorizontal:8},appNameLandscape:{fontSize:16},
  appName:{color:"#f3d294",fontSize:21,fontWeight:"800"},subtitle:{color:"#bdc9c0",fontSize:9,marginTop:3},
  rightHeader:{alignItems:"flex-end"},population:{color:"#efdaaa",fontSize:13,fontWeight:"700"},
  zoneHeader:{minHeight:36,paddingHorizontal:12,backgroundColor:"#263d34",flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  zoneHeaderTight:{minHeight:30,paddingHorizontal:9},zoneHeaderLandscape:{minHeight:24},
  zoneTitle:{fontWeight:"800",fontSize:13,color:"#f3e6c3",flexShrink:1},
  zoneSummary:{color:"#d4e1d5",fontSize:10,marginLeft:5},
  mapArea:{flex:1,alignItems:"center",justifyContent:"center",position:"relative",backgroundColor:"#152820",overflow:"hidden"},
  mapGrid:{borderWidth:2,borderColor:"#927b53",position:"relative",overflow:"hidden",backgroundColor:"#60945b"},
  entity:{position:"absolute",alignItems:"center",justifyContent:"center"},
  resident:{position:"absolute",alignItems:"center",justifyContent:"center"},
  selected:{borderColor:"#ffec89",borderWidth:2},
  arrow:{position:"absolute",width:44,height:44,backgroundColor:"#223c32ea",borderWidth:2,borderColor:"#f3d392",borderRadius:9,justifyContent:"center",alignItems:"center"},
  arrowText:{fontSize:25,color:"#fee7ae",fontWeight:"800"},
  north:{top:8,alignSelf:"center"},south:{bottom:8,alignSelf:"center"},
  east:{right:7,top:"50%",transform:[{translateY:-22}]},west:{left:7,top:"50%",transform:[{translateY:-22}]},disabled:{opacity:.2},
  footer:{flexDirection:"row",alignItems:"center",padding:9,minHeight:91,gap:8,backgroundColor:"#182831",borderTopWidth:2,borderTopColor:"#7c5c37"},
  footerTight:{minHeight:78,padding:5,gap:5},
  footerLandscape:{minHeight:58,padding:3,gap:5},
  miniMap:{width:76,height:76,padding:3,backgroundColor:"#0e2323",borderWidth:1,borderColor:"#799585",borderRadius:6,flexDirection:"row",flexWrap:"wrap",justifyContent:"center"},
  miniMapLandscape:{width:58,height:58,padding:2},
  miniCell:{width:21,height:21,margin:1,backgroundColor:"#3a5a4e",borderRadius:3,justifyContent:"center",alignItems:"center"},
  miniCellLandscape:{width:15,height:15,margin:.5},miniTextLandscape:{fontSize:9},
  miniCellActive:{backgroundColor:"#e7bf75"},
  miniPlaceholder:{width:21,height:21,margin:1},
  miniText:{color:"#e0eecf",fontSize:10,fontWeight:"600"},miniTextActive:{color:"#19362d"},
  details:{flex:1,minWidth:0},detailName:{fontSize:13,fontWeight:"800",color:"#f2cc8c"},
  detailBody:{fontSize:11,color:"#d4dbd3"},detailCount:{fontSize:10,color:"#a7c4b7",marginTop:2},
  selectionButtons:{flexDirection:"row",gap:2},
  selectButton:{width:44,height:44,backgroundColor:"#354940",borderRadius:6,borderWidth:1,borderColor:"#9f7c51",alignItems:"center",justifyContent:"center"},
  selectText:{fontSize:29,color:"#f4debd",fontWeight:"700",lineHeight:34},
  controls:{gap:5,paddingHorizontal:7,paddingVertical:10,alignItems:"center",backgroundColor:"#354940",borderRadius:6,borderWidth:1,borderColor:"#9f7c51"},
  controlLabel:{fontSize:11,color:"#f4debd",fontWeight:"700"},
  controlNote:{fontSize:9,color:"#bed2c7"},
  disclaimer:{textAlign:"center",fontSize:9,color:"#9fafa5",backgroundColor:"#182831",paddingBottom:3}
});
