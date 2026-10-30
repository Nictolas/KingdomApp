import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createSectorSaveQueue, loadSectorKingdom } from "../game/sectorPlayablePersistence";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  advancePlayableDay, applySectorAction, COSTS, createPlayableKingdom,
  travelSector,
  type PlayableKingdom, type SectorActionMode, type SectorBuildKind
} from "../game/sectorPlayableModel";
import { fitSquareGrid, isRoadCell, neighborSector, PREVIEW_COLS, PREVIEW_ROWS, SECTOR_IDS, type SectorId } from "../game/sectorPreviewModel";

const HOUSE=require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/house_1.png");
const HUT=require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/house_2.png");
const CASTLE=require("../../assets/pixel-art/buildings/castle.png");
const TREE=require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/tree_1.png");
const COLORS=["#bb725a","#6489ab","#a39e5b","#896d9c","#5f967d"];
const NAV: Array<{id:SectorId;label:string}>=[
  {id:"nord",label:"Nord"},{id:"ovest",label:"Ovest"},{id:"centro",label:"Centro"},
  {id:"est",label:"Est"},{id:"sud",label:"Sud"}
];
const TOOLS:Array<{id:SectorActionMode;label:string}>=[
  {id:"inspect",label:"Esplora"},{id:"house",label:"Casa"},{id:"farm",label:"Fattoria"},
  {id:"shop",label:"Bottega"},{id:"demolish",label:"Demolisci"}
];
const getAsset=(kind:string)=>kind==="castle"?CASTLE:kind==="hut"||kind==="farm"?HUT:HOUSE;
export function SectorPlayableScreen({onExit}:{onExit:()=>void}) {
  const [game,setGame]=useState<PlayableKingdom|null>(null);
  const [loaded,setLoaded]=useState(false);
  const [paused,setPaused]=useState(false);
  const [saveEnabled,setSaveEnabled]=useState(false);
  const [saveWarning,setSaveWarning]=useState<string|null>(null);
  const [confirmReset,setConfirmReset]=useState(false);
  const [exiting,setExiting]=useState(false);
  const saveQueue=useRef(createSectorSaveQueue(AsyncStorage)).current;
  const [tool,setTool]=useState<SectorActionMode>("inspect");
  const [mapArea,setMapArea]=useState({width:0,height:0});
  const {width:screenWidth,height:screenHeight}=useWindowDimensions();
  const tight=screenWidth<380||screenHeight<740;
  useEffect(()=>{
    let alive=true;
    void loadSectorKingdom(AsyncStorage).then(({kingdom,invalid})=>{
      if(!alive)return;
      setGame(kingdom);
      setSaveEnabled(!invalid);
      if(invalid) setSaveWarning("Salvataggio settori illeggibile: la copia originale è preservata. Usa Ricomincia per iniziare un nuovo salvataggio.");
      setLoaded(true);
    });
    return ()=>{alive=false;};
  },[]);
  useEffect(()=>{
    if(!loaded||!game||!saveEnabled)return;
    void saveQueue.enqueue(game).then(()=>setSaveWarning(null)).catch(()=>{
      setSaveWarning("Salvataggio non riuscito. Riprova prima di uscire.");
    });
  },[loaded,game,saveEnabled,saveQueue]);
  useEffect(()=>{
    if(!loaded||paused)return;
    const timer=setInterval(()=>setGame(g=>g?advancePlayableDay(g):g),7000);
    return ()=>clearInterval(timer);
  },[loaded,paused]);
  const sector=game?.sector??"centro";
  const world=game?.sectors[sector];
  const cell=fitSquareGrid(Math.max(0,mapArea.width-8),Math.max(0,mapArea.height-8));
  const tiles=useMemo(()=>Array.from({length:PREVIEW_COLS*PREVIEW_ROWS},(_,i)=>{
    const x=i%PREVIEW_COLS,y=Math.floor(i/PREVIEW_COLS);
    const road=isRoadCell(x,y);
    const variation=(x*13+y*29)%4;
    return {x,y,road,color: road?["#aca18c","#b8ae97","#b1a58f","#c0b499"][variation]:
      ["#70a265","#66965b","#62915b","#75a66b"][variation]};
  }),[]);
  const totalPopulation=useMemo(()=>game?SECTOR_IDS.reduce((sum,id)=>sum+game.sectors[id].residents.length,0):0,[game]);
  const pressTile=useCallback((x:number,y:number)=>{
    setGame(prev=>prev?applySectorAction(prev,tool,x,y):prev);
  },[tool]);
  const navigate=useCallback((next:SectorId)=>{
    setGame(prev=>prev?travelSector(prev,next):prev);
    setTool("inspect");
  },[]);
  const reset=()=>{
    setConfirmReset(false);
    setPaused(true);
    setSaveEnabled(true);
    setSaveWarning(null);
    setGame(createPlayableKingdom());
    setTool("inspect");
  };
  const exit=async()=>{
    if(exiting)return;
    setExiting(true);
    if(game && saveEnabled){
      try { await saveQueue.enqueue(game); }
      catch {
        setSaveWarning("Impossibile salvare il regno. Riprova a uscire quando la memoria è disponibile.");
        setExiting(false);
        return;
      }
    }
    onExit();
  };
  if(!loaded||!game||!world) return (
    <SafeAreaView style={styles.root}><View style={styles.loading}><Text style={styles.title}>Caricamento Regno a settori…</Text></View></SafeAreaView>
  );
  return (
    <SafeAreaView testID="sector-game-root" edges={["top","bottom","left","right"]} style={styles.root}>
      <View style={[styles.header,tight&&styles.headerTight]}>
        <Pressable testID="sector-game-exit" accessibilityRole="button" accessibilityLabel="Torna alle modalità" disabled={exiting} onPress={()=>{void exit();}} style={styles.back}>
          <Text style={styles.backText}>‹ Modalità</Text>
        </Pressable>
        <View style={styles.headerCenter}><Text style={styles.title}>REGNO A SETTORI</Text><Text style={styles.subTitle}>PROTOTIPO GIOCABILE · Giorno {game.day}</Text></View>
        <Pressable accessibilityRole="button" onPress={()=>setPaused(p=>!p)} style={styles.pause}><Text style={styles.backText}>{paused?"▶":"❚❚"}</Text></Pressable>
      </View>
      {saveWarning ? <Text testID="sector-game-save-warning" style={styles.saveWarning}>{saveWarning}</Text> : null}
      <View style={styles.resources} testID="sector-game-resources">
        <Text style={styles.resource}>🪙 {game.gold}</Text>
        <Text style={styles.resource}>🪵 {game.wood}</Text>
        <Text style={styles.resource}>🌾 {game.food}</Text>
        <Text style={styles.resource}>👤 {totalPopulation}</Text>
      </View>
      <View style={styles.zoneHeader}>
        <Text style={styles.zoneTitle}>{sector.toLocaleUpperCase("it-IT")} · {world.residents.length} abitanti</Text>
        <Text style={styles.zoneSub}>16 × 24 caselle · {world.buildings.length} edifici</Text>
      </View>
      <View testID="sector-game-map-area" style={styles.mapArea} onLayout={e=>{
        const {width,height}=e.nativeEvent.layout;
        setMapArea(old=>old.width===width&&old.height===height?old:{width,height});
      }}>
        {cell>0&&<View testID="sector-game-grid" style={[styles.grid,{width:PREVIEW_COLS*cell,height:PREVIEW_ROWS*cell}]}>
          {tiles.map((t,i)=><View pointerEvents="none" key={i} style={{
            position:"absolute",left:t.x*cell,top:t.y*cell,width:cell,height:cell,
            backgroundColor:t.color,borderColor:"#365a3444",borderWidth:StyleSheet.hairlineWidth
          }}/>)}
          {tiles.filter(t=>sector==="nord"&&!t.road&&
             ((t.x*17+t.y*31)%11===0)&&!world.buildings.some(b=>t.x>=b.x&&t.x<b.x+b.w&&t.y>=b.y&&t.y<b.y+b.h))
           .map(t=><Image key={"tree"+t.y+"-"+t.x} source={TREE}
             style={{position:"absolute",left:t.x*cell,top:t.y*cell,width:cell,height:cell}} resizeMode="contain"/>)}
          {world.buildings.map(b=><Image key={b.id} source={getAsset(b.kind)}
            resizeMode="contain" style={{position:"absolute",left:b.x*cell,top:b.y*cell,width:b.w*cell,height:b.h*cell}}/>)}
          {world.residents.map((p,i)=><View pointerEvents="none" key={p.id}
            style={{position:"absolute",left:p.x*cell,top:p.y*cell,width:cell,height:cell,justifyContent:"center",alignItems:"center"}}>
            <View style={{width:Math.max(4,cell*.36),height:Math.max(4,cell*.32),backgroundColor:i%2?"#edc59c":"#c99472",
              borderTopWidth:Math.max(2,cell*.08),borderTopColor:"#594332",borderRadius:3}}/>
            <View style={{width:Math.max(5,cell*.5),height:Math.max(5,cell*.35),
              backgroundColor:COLORS[i%COLORS.length],borderRadius:2}}/>
          </View>)}
          <Pressable testID="sector-game-tap-grid" accessibilityRole="button" accessibilityLabel="Griglia di gioco, tocca una casella"
            style={[StyleSheet.absoluteFill,{zIndex:9}]} onPress={e=>{
              if(!cell)return;
              const point=e.nativeEvent as typeof e.nativeEvent & {offsetX?:number;offsetY?:number};
              const localX=Number.isFinite(point.locationX)?point.locationX:point.offsetX;
              const localY=Number.isFinite(point.locationY)?point.locationY:point.offsetY;
              if(!Number.isFinite(localX)||!Number.isFinite(localY))return;
              const x=Math.floor((localX as number)/cell),y=Math.floor((localY as number)/cell);
              pressTile(x,y);
            }}/>
        </View>}
      </View>
      <View testID="sector-game-navigation" style={styles.navigation}>
        {(["n","w","s","e"] as const).map(dir=>{
          const next=neighborSector(sector,dir);
          const glyph={n:"↑ Nord",w:"← Ovest",s:"↓ Sud",e:"Est →"}[dir];
          return <Pressable key={dir} disabled={!next} accessibilityRole="button"
             accessibilityLabel={"Vai a "+glyph} onPress={()=>next&&navigate(next)}
             style={[styles.navButton,!next&&styles.disabled]}><Text style={styles.navText}>{glyph}</Text></Pressable>;
        })}
      </View>
      <View style={styles.toolPanel}>
        <View testID="sector-game-tools" style={styles.toolButtons}>
          {TOOLS.map(t=><Pressable key={t.id} accessibilityRole="button" accessibilityLabel={t.label}
            accessibilityState={{selected:tool===t.id}}
            onPress={()=>setTool(t.id)}
            style={[styles.toolButton,tool===t.id&&styles.toolSelected]}>
            <Text style={[styles.toolLabel,tight&&styles.toolLabelTight]}>{t.label}</Text>
          </Pressable>)}
        </View>
        <Text style={styles.hint} numberOfLines={2}>
          {tool==="inspect"?"Tocca un abitante, un edificio o il terreno.":
            tool==="demolish"?"Tocca un edificio costruito da te per rimuoverlo.":
            `${COSTS[tool as SectorBuildKind].name}: ${COSTS[tool as SectorBuildKind].wood} legni + ${COSTS[tool as SectorBuildKind].gold} monete. Tocca un'area libera 2×2.`}
        </Text>
        <Text testID="sector-game-notice" style={styles.notice} numberOfLines={2}>{game.notice}</Text>
        <View style={styles.actions}>
          <Pressable testID="sector-game-next-day" style={styles.dayButton}
            accessibilityRole="button" onPress={()=>setGame(g=>g?advancePlayableDay(g):g)}>
            <Text style={styles.dayText}>☀ Giorno successivo</Text>
          </Pressable>
          <Pressable style={styles.resetButton} accessibilityRole="button" onPress={()=>setConfirmReset(true)}>
            <Text style={styles.resetText}>Ricomincia</Text>
          </Pressable>
        </View>
        <View style={styles.sectorTabs}>
          {NAV.map(n=><Pressable key={n.id} accessibilityRole="button"
              accessibilityLabel={"Visita "+n.label} accessibilityState={{selected:sector===n.id}}
              onPress={()=>navigate(n.id)} style={[styles.tab,sector===n.id&&styles.tabActive]}>
            <Text style={[styles.tabText,sector===n.id&&styles.tabTextActive]}>{n.label}</Text>
          </Pressable>)}
        </View>
      </View>
      <Modal visible={confirmReset} transparent animationType="fade" onRequestClose={()=>setConfirmReset(false)}>
        <View style={styles.modalBackdrop} testID="sector-game-reset-dialog">
          <View style={styles.modalCard}>
            <Text style={styles.title}>Ricominciare il Regno a settori?</Text>
            <Text style={styles.modalText}>Questo sostituisce solo il salvataggio della modalità a settori. Avventura e Creativa non vengono modificate.</Text>
            <View style={styles.actions}>
              <Pressable testID="sector-game-reset-cancel" style={styles.resetButton} accessibilityRole="button" onPress={()=>setConfirmReset(false)}>
                <Text style={styles.resetText}>Annulla</Text>
              </Pressable>
              <Pressable testID="sector-game-reset-confirm" style={styles.dayButton} accessibilityRole="button" onPress={reset}>
                <Text style={styles.dayText}>Ricomincia</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:"#13231c"},
  saveWarning:{color:"#ffe1a0",backgroundColor:"#743b28",padding:5,fontSize:11},
  modalBackdrop:{flex:1,backgroundColor:"rgba(0,0,0,.78)",justifyContent:"center",padding:24},
  modalCard:{backgroundColor:"#22372f",padding:20,borderRadius:12,gap:12},
  modalText:{color:"#f3e6c9",fontSize:13,lineHeight:19},
  loading:{flex:1,justifyContent:"center",alignItems:"center"},
  header:{flexDirection:"row",minHeight:53,alignItems:"center",paddingHorizontal:8,
    backgroundColor:"#22372f",borderBottomWidth:1,borderBottomColor:"#856c3a",gap:6},
  headerTight:{minHeight:42},
  back:{paddingHorizontal:7,paddingVertical:8,backgroundColor:"#384d43",borderRadius:7},
  backText:{fontSize:11,color:"#f4e1bf",fontWeight:"700"},
  headerCenter:{flex:1,alignItems:"center"},
  title:{fontSize:14,color:"#f6d99f",fontWeight:"900"},
  subTitle:{fontSize:9,color:"#c2ccb9",marginTop:2},
  pause:{minWidth:38,minHeight:38,alignItems:"center",justifyContent:"center",backgroundColor:"#384d43",borderRadius:7},
  resources:{minHeight:33,flexDirection:"row",justifyContent:"space-around",alignItems:"center",backgroundColor:"#263f31"},
  resource:{fontSize:12,fontWeight:"800",color:"#fff1c6"},
  zoneHeader:{minHeight:27,flexDirection:"row",paddingHorizontal:9,alignItems:"center",justifyContent:"space-between",backgroundColor:"#31523b"},
  zoneTitle:{color:"#f6e7bd",fontWeight:"800",fontSize:12},
  zoneSub:{color:"#e4f0d7",fontSize:9},
  mapArea:{flex:1,position:"relative",justifyContent:"center",alignItems:"center",overflow:"hidden",backgroundColor:"#24452f"},
  grid:{position:"relative",backgroundColor:"#70a265",borderWidth:1,borderColor:"#a38b57",overflow:"hidden"},
  navigation:{flexDirection:"row",height:41,padding:3,gap:5,backgroundColor:"#182e24"},
  navButton:{flex:1,borderRadius:6,borderWidth:1,borderColor:"#96824e",backgroundColor:"#38553c",alignItems:"center",justifyContent:"center"},
  disabled:{opacity:.28},
  navText:{color:"#f2e3b7",fontSize:12,fontWeight:"800"},
  toolPanel:{backgroundColor:"#17291f",paddingHorizontal:7,paddingTop:7,paddingBottom:4},
  toolButtons:{flexDirection:"row",gap:4},
  toolButton:{flex:1,minHeight:36,paddingHorizontal:3,alignItems:"center",justifyContent:"center",borderRadius:6,
    borderColor:"#667f62",borderWidth:1,backgroundColor:"#304739"},
  toolSelected:{backgroundColor:"#806338",borderColor:"#f4d693"},
  toolLabel:{fontSize:11,color:"#f3e6c9",fontWeight:"800"},toolLabelTight:{fontSize:10},
  hint:{fontSize:10,color:"#c6d3c3",paddingTop:5,minHeight:17},
  notice:{fontSize:11,color:"#f5d399",fontWeight:"600",paddingTop:5,minHeight:24},
  actions:{flexDirection:"row",gap:7,paddingTop:5},
  dayButton:{flex:1,backgroundColor:"#39724d",paddingVertical:9,alignItems:"center",borderRadius:7},
  dayText:{color:"#fff4d7",fontWeight:"800",fontSize:12},
  resetButton:{backgroundColor:"#3a4a41",paddingHorizontal:13,justifyContent:"center",borderRadius:7},
  resetText:{color:"#efdbbd",fontSize:11,fontWeight:"700"},
  sectorTabs:{flexDirection:"row",gap:4,marginTop:6},
  tab:{flex:1,minHeight:27,alignItems:"center",justifyContent:"center",borderRadius:5,backgroundColor:"#304d3c"},
  tabActive:{backgroundColor:"#deb76f"},tabText:{color:"#dae7d6",fontSize:10,fontWeight:"700"},tabTextActive:{color:"#283523"}
});
