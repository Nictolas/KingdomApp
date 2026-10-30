import React,{useCallback,useEffect,useMemo,useRef,useState} from "react";
import {
  Image,Modal,Pressable,ScrollView,StyleSheet,Text,View,useWindowDimensions
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TerrainSheetSprite } from "../components/TerrainSheetSprite";
import { getErbaSheetCoord,getWaterSheetCoord,type SheetCoord } from "../game/overworldSpritesheetLayout";
import { sectorBuildingAccent } from "../game/sectorPlayableTerrain";
import { fitSquareGrid } from "../game/sectorPreviewModel";
import { createTerritoryWriteQueue,loadTerritoryWorld } from "../game/territoryWorldPersistence";
import {
  TERRITORY_SIDE,TERRITORY_BUILDINGS,BIOME_LABELS,CONQUEST_GOLD_COST,CONQUEST_WOOD_COST,
  advanceTerritoryDay,buildAtFirstAvailable,claimTerritory,createTerritoryWorld,
  groundAt,neighborCoordinates,territoryAction,territoryKey,territoryLabel,
  territoryPreview,tileAt,visitTerritory,worldMilitaryStrength,worldPopulation,
  type Direction,type TerritoryBuildingKind,type TerritoryTile,type TerritoryTool,
  type TerritoryWorld
} from "../game/territoryWorldModel";

const HOUSE=require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/house_1.png");
const HUT=require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/house_2.png");
const CASTLE=require("../../assets/pixel-art/buildings/castle.png");
const TREE=require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/tree_1.png");
const CHARACTER=require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/character.png");
const ROAD_X=512,ROAD_Y=128;
const tools:readonly {id:TerritoryTool;label:string}[]=[
  {id:"inspect",label:"Esplora"},{id:"road",label:"Strada"},
  {id:"clear",label:"Disbosca"},{id:"house",label:"Casa"},
  {id:"farm",label:"Fattoria"},{id:"shop",label:"Bottega"},
  {id:"lumber",label:"Segheria"},{id:"guard",label:"Caserma"},
  {id:"demolish",label:"Demolisci"}
];
const directions:readonly {id:Direction;label:string}[]=[
  {id:"n",label:"Nord"},{id:"e",label:"Est"},{id:"s",label:"Sud"},{id:"w",label:"Ovest"}
];
const getBuildingAsset=(kind:TerritoryBuildingKind)=>
  kind==="castle"?CASTLE:kind==="farm"||kind==="lumber"||kind==="guard"?HUT:HOUSE;
const isConstructible=(tool:TerritoryTool):tool is Exclude<TerritoryBuildingKind,"castle"> =>
  tool==="house"||tool==="farm"||tool==="shop"||tool==="lumber"||tool==="guard";

function WorldResidentSprite({cell,index,frame}:{cell:number;index:number;frame:number}){
  const sourceIndex=(index%4)*3+(frame+index)%3;
  return <View pointerEvents="none" style={{width:cell,height:cell,justifyContent:"flex-end"}}>
    <View style={{width:cell,height:cell*1.22,overflow:"hidden"}}>
      <Image source={CHARACTER} testID="territory-resident-image"
        resizeMode="stretch" style={{position:"absolute",width:cell*12,height:cell*1.22,left:-sourceIndex*cell,top:0}}/>
    </View>
  </View>;
}
function terrainArt(tile:TerritoryTile,x:number,y:number,isRoad:(x:number,y:number)=>boolean):SheetCoord{
  if(tile==="water")return getWaterSheetCoord(0);
  if(tile==="road"){
    const west=x===0||!isRoad(x-1,y),east=x===31||!isRoad(x+1,y);
    const north=y===0||!isRoad(x,y-1),south=y===31||!isRoad(x,y+1);
    return {x:ROAD_X+(west?0:east?128:64),y:ROAD_Y+(north?0:south?128:64)};
  }
  if(tile==="dry")return {x:192,y:192};
  return getErbaSheetCoord((x*13+y*23)%9===0?"campo_nord_est":"centro");
}
function limit(n:number,min:number,max:number){return Math.max(min,Math.min(max,n));}
export function TerritoryWorldScreen({onExit}:{onExit:()=>void}){
  const [world,setWorld]=useState<TerritoryWorld|null>(null);
  const [loaded,setLoaded]=useState(false);
  const [saveEnabled,setSaveEnabled]=useState(false);
  const [saveError,setSaveError]=useState<string|null>(null);
  const [pause,setPause]=useState(false);
  const [frame,setFrame]=useState(0);
  const [tool,setTool]=useState<TerritoryTool>("inspect");
  const [viewport,setViewport]=useState(12);
  const [camera,setCamera]=useState({x:5,y:5});
  const [mapArea,setMapArea]=useState({width:0,height:0});
  const [mapOpen,setMapOpen]=useState(false);
  const [selectedKey,setSelectedKey]=useState("0,0");
  const [resetOpen,setResetOpen]=useState(false);
  const [exiting,setExiting]=useState(false);
  const {width:screenWidth,height:screenHeight}=useWindowDimensions();
  const tight=screenWidth<370||screenHeight<650;
  const queue=useRef(createTerritoryWriteQueue(AsyncStorage)).current;

  useEffect(()=>{
    let alive=true;
    void loadTerritoryWorld(AsyncStorage).then(({world:loadedWorld,invalid})=>{
      if(!alive)return;
      setWorld(loadedWorld);
      setSaveEnabled(!invalid);
      if(invalid)setSaveError("Salvataggio territori non leggibile: copia originale preservata. Premi Ricomincia per sostituirlo.");
      setLoaded(true);
    }).catch(()=>{
      if(!alive)return;
      setWorld(createTerritoryWorld());
      setSaveError("Non è possibile leggere la memoria. Il regno non verrà sovrascritto.");
      setLoaded(true);
    });
    return ()=>{alive=false;};
  },[]);
  useEffect(()=>{
    if(!loaded||!world||!saveEnabled)return;
    void queue.enqueue(world).then(()=>setSaveError(null)).catch(()=>
      setSaveError("Salvataggio non riuscito: riprova prima di uscire."));
  },[loaded,world,saveEnabled,queue]);
  useEffect(()=>{
    if(!loaded||pause||!world)return;
    const timer=setInterval(()=>setWorld(prev=>prev?advanceTerritoryDay(prev):prev),7000);
    return ()=>clearInterval(timer);
  },[loaded,pause,!!world]);
  useEffect(()=>{
    if(!loaded||pause||!world)return;
    const timer=setInterval(()=>setFrame(f=>(f+1)%3),280);
    return ()=>clearInterval(timer);
  },[loaded,pause,!!world]);

  const territory=world?.territories[world.active];
  const cell=fitSquareGrid(Math.max(0,mapArea.width-8),Math.max(0,mapArea.height-8),viewport,viewport);
  const activeKey=world?.active??"0,0";
  const tiles=useMemo(()=>{
    if(!world||!territory)return [];
    const isRoad=(x:number,y:number)=>
      x>=0&&y>=0&&x<TERRITORY_SIDE&&y<TERRITORY_SIDE&&tileAt(world,territory,x,y)==="road";
    return Array.from({length:viewport*viewport},(_,i)=>{
      const x=camera.x+i%viewport,y=camera.y+Math.floor(i/viewport);
      const kind=tileAt(world,territory,x,y);
      return {x,y,kind,coord:terrainArt(kind,x,y,isRoad)};
    });
  },[world?.seed,activeKey,territory?.roads,territory?.cleared,camera.x,camera.y,viewport]);

  const resetCamera=useCallback(()=>setCamera({x:limit(15-Math.floor(viewport/2),0,32-viewport),
    y:limit(15-Math.floor(viewport/2),0,32-viewport)}),[viewport]);
  const pan=(dx:number,dy:number)=>setCamera(c=>({
    x:limit(c.x+dx,0,TERRITORY_SIDE-viewport),
    y:limit(c.y+dy,0,TERRITORY_SIDE-viewport)
  }));
  const setZoom=(size:number)=>{
    const next=limit(size,8,16);
    setCamera(old=>({
      x:limit(old.x+Math.floor((viewport-next)/2),0,TERRITORY_SIDE-next),
      y:limit(old.y+Math.floor((viewport-next)/2),0,TERRITORY_SIDE-next)
    }));
    setViewport(next);
  };
  const placeTile=(x:number,y:number)=>{
    setWorld(prev=>prev?territoryAction(prev,tool,x,y):prev);
  };
  const openMap=()=>{
    if(!world)return;
    setSelectedKey(world.active);
    setMapOpen(true);
  };
  const chooseExpansion=(method:"purchase"|"conquest")=>{
    if(!world)return;
    const point=selectedKey.split(",").map(Number),tx=point[0]!,ty=point[1]!;
    const next=claimTerritory(world,tx,ty,method);
    setWorld(next);
    if(next.territories[selectedKey]){
      setMapOpen(false);setTool("inspect");
      setCamera({x:5,y:5});
    }
  };
  const visit=(key:string)=>{
    setWorld(prev=>prev?visitTerritory(prev,key):prev);
    setMapOpen(false);setTool("inspect");setCamera({x:5,y:5});
  };
  const reset=()=>{
    setResetOpen(false);
    setMapOpen(false);
    setPause(true);
    setSaveEnabled(true);
    setSaveError(null);
    setWorld(createTerritoryWorld());
    setTool("inspect");setCamera({x:5,y:5});setViewport(12);
  };
  const exit=async()=>{
    if(exiting)return;
    setExiting(true);
    if(world&&saveEnabled){
      try{await queue.enqueue(world);await queue.flush();}
      catch{
        setSaveError("Impossibile salvare: controlla lo spazio disponibile e riprova.");
        setExiting(false);
        return;
      }
    }
    onExit();
  };
  if(!loaded||!world||!territory)return (
    <SafeAreaView style={styles.root}><View style={styles.loading}><Text style={styles.title}>Creazione mondo 32×32…</Text></View></SafeAreaView>
  );

  const ownedCount=Object.keys(world.territories).length;
  const [tx,ty]=[territory.tx,territory.ty];
  const center={tx,ty};
  const nearby=Array.from({length:25},(_,i)=>{
    const xx=tx+(i%5)-2,yy=ty+Math.floor(i/5)-2;
    return territoryPreview(world,xx,yy);
  });
  const selectedCoords=selectedKey.split(",").map(Number);
  const selected=territoryPreview(world,selectedCoords[0]!,selectedCoords[1]!);
  const displayedResidents=territory.residents.filter(p=>
    p.x>=camera.x&&p.y>=camera.y&&p.x<camera.x+viewport&&p.y<camera.y+viewport);
  const displayedBuildings=territory.buildings.filter(b=>
    b.x+b.w>camera.x&&b.y+b.h>camera.y&&b.x<camera.x+viewport&&b.y<camera.y+viewport);

  return (
    <SafeAreaView testID="territory-world-root" edges={["top","bottom","left","right"]} style={styles.root}>
      <View style={styles.header}>
        <Pressable testID="territory-world-exit" accessibilityRole="button"
          accessibilityLabel="Esci da Regno a territori" disabled={exiting}
          onPress={()=>{void exit();}} style={styles.back}>
          <Text style={styles.light}>‹ Modalità</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.title,tight&&styles.titleSmall]}>REGNO A TERRITORI</Text>
          <Text style={styles.muted}>32×32 · Giorno {world.day}</Text>
        </View>
        <Pressable testID="territory-world-pause" accessibilityRole="button"
          accessibilityLabel={pause?"Riprendi il tempo":"Metti in pausa il tempo"}
          onPress={()=>setPause(v=>!v)} style={styles.back}>
          <Text style={styles.light}>{pause?"▶":"❚❚"}</Text>
        </Pressable>
      </View>
      {saveError?<Text testID="territory-world-save-error" style={styles.warning}>{saveError}</Text>:null}
      <View testID="territory-world-resources" style={styles.resources}>
        <Text style={styles.resource}>Monete {world.gold}</Text>
        <Text style={styles.resource}>Legno {world.wood}</Text>
        <Text style={styles.resource}>Cibo {world.food}</Text>
        <Text style={styles.resource}>Abitanti {worldPopulation(world)}</Text>
      </View>
      <View style={styles.territoryHeading}>
        <View style={{flex:1}}>
          <Text testID="territory-world-label" style={styles.landTitle}>{territoryLabel(world.seed,tx,ty)}</Text>
          <Text style={styles.muted}>{BIOME_LABELS[territory.biome]} · {territory.residents.length} abitanti · {ownedCount} territori · ({tx},{ty})</Text>
        </View>
        <Pressable testID="territory-open-map" accessibilityRole="button"
          accessibilityLabel="Mappa del regno: compra o conquista territori" style={styles.mapButton} onPress={openMap}>
          <Text style={styles.light}>Mappa regno</Text>
        </Pressable>
      </View>
      <View style={styles.mapArea} testID="territory-world-map-area"
        onLayout={e=>setMapArea({width:e.nativeEvent.layout.width,height:e.nativeEvent.layout.height})}>
        {cell>0?<View testID="territory-world-grid" style={{
          width:cell*viewport,height:cell*viewport,overflow:"hidden",position:"relative",
          borderWidth:1,borderColor:"#bda577"
        }}>
          {tiles.map(t=><Pressable
            testID="territory-world-tile" key={t.x+","+t.y} accessibilityRole="button"
            accessibilityLabel={"Casella "+(t.x+1)+","+(t.y+1)+": "+t.kind}
            onPress={()=>placeTile(t.x,t.y)}
            style={{position:"absolute",left:(t.x-camera.x)*cell,top:(t.y-camera.y)*cell,
              width:cell,height:cell,overflow:"hidden"}}>
            <TerrainSheetSprite cellSize={cell} coord={t.coord}/>
            {t.kind==="woodland"?<Image source={TREE} resizeMode="contain"
              style={{width:cell,height:cell,position:"absolute",top:0}} pointerEvents="none"/>:null}
            {t.kind==="rock"?<View pointerEvents="none" style={{position:"absolute",width:cell,height:cell,
              backgroundColor:"rgba(56,61,65,0.70)",borderRadius:cell/3}}/>:null}
            {t.kind==="dry"?<View pointerEvents="none" style={{position:"absolute",width:cell,height:cell,
              backgroundColor:"rgba(179,137,66,0.32)"}}/>:null}
          </Pressable>)}
          {displayedBuildings.map(b=>{
            const crop=sectorBuildingAccent(b.kind);
            return <View pointerEvents="none" testID="territory-world-building" key={b.id}
              style={{position:"absolute",left:(b.x-camera.x)*cell,top:(b.y-camera.y)*cell,
                width:cell*b.w,height:cell*b.h,justifyContent:"center",alignItems:"center",overflow:"hidden"}}>
              <Image source={getBuildingAsset(b.kind)} resizeMode="contain"
                style={{width:"95%",height:"95%"}}/>
              {crop?<View testID="territory-world-building-accent"
                style={{position:"absolute",right:0,bottom:0,width:cell,height:cell}}>
                <TerrainSheetSprite coord={crop} cellSize={cell}/>
              </View>:null}
            </View>;
          })}
          {displayedResidents.map((p,i)=><View pointerEvents="none" testID="territory-world-resident"
            key={p.id} style={{position:"absolute",left:(p.x-camera.x)*cell,top:(p.y-camera.y)*cell,
              width:cell,height:cell}}>
            <WorldResidentSprite cell={cell} index={i} frame={frame}/>
          </View>)}
        </View>:<Text style={styles.muted}>Preparazione visualizzazione…</Text>}
      </View>
      <View testID="territory-world-camera" style={styles.cameraRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Scorri mappa verso sinistra"
          style={styles.cameraButton} onPress={()=>pan(-5,0)}><Text style={styles.light}>◀</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Scorri mappa verso l'alto"
          style={styles.cameraButton} onPress={()=>pan(0,-5)}><Text style={styles.light}>▲</Text></Pressable>
        <Text testID="territory-world-visible-range" style={styles.rangeLabel}>{camera.x+1}–{camera.x+viewport} / {camera.y+1}–{camera.y+viewport}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Scorri mappa verso il basso"
          style={styles.cameraButton} onPress={()=>pan(0,5)}><Text style={styles.light}>▼</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Scorri mappa verso destra"
          style={styles.cameraButton} onPress={()=>pan(5,0)}><Text style={styles.light}>▶</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Ingrandisci"
          style={styles.zoomButton} onPress={()=>setZoom(viewport-2)}><Text style={styles.light}>＋</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Riduci ingrandimento"
          style={styles.zoomButton} onPress={()=>setZoom(viewport+2)}><Text style={styles.light}>－</Text></Pressable>
      </View>
      <ScrollView testID="territory-world-tools" horizontal showsHorizontalScrollIndicator={false}
        style={styles.toolScroll} contentContainerStyle={styles.toolList}>
        {tools.map(t=><Pressable key={t.id} testID={"territory-tool-"+t.id}
          accessibilityRole="button" accessibilityLabel={t.label}
          accessibilityState={{selected:tool===t.id}}
          onPress={()=>setTool(t.id)} style={[styles.toolButton,tool===t.id&&styles.toolActive]}>
          <Text style={[styles.toolLabel,tool===t.id&&styles.toolActiveText]}>{t.label}</Text>
        </Pressable>)}
      </ScrollView>
      <Text testID="territory-world-notice" numberOfLines={2} style={styles.notice}>{world.notice}</Text>
      <View style={styles.actions}>
        <Pressable testID="territory-world-next-day" accessibilityRole="button" accessibilityLabel="Avanza un giorno"
          style={styles.primary} onPress={()=>setWorld(w=>w?advanceTerritoryDay(w):w)}>
          <Text style={styles.light}>Giorno +</Text>
        </Pressable>
        <Pressable testID="territory-world-auto-build" accessibilityRole="button"
          accessibilityLabel="Posiziona il tipo di edificio selezionato"
          style={[styles.primary,{backgroundColor:"#755b38"}]} onPress={()=>{
            if(!isConstructible(tool))return;
            setWorld(w=>w?buildAtFirstAvailable(w,tool):w);
          }}>
          <Text style={styles.light}>Posiziona</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Ricomincia Regno a territori"
          style={styles.resetButton} onPress={()=>setResetOpen(true)}><Text style={styles.light}>Ricomincia</Text></Pressable>
      </View>

      <Modal visible={mapOpen} transparent animationType="fade" onRequestClose={()=>setMapOpen(false)}>
        <SafeAreaView style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.title}>Espandi il regno</Text>
              <Pressable testID="territory-map-close" accessibilityRole="button"
                accessibilityLabel="Chiudi mappa del regno" onPress={()=>setMapOpen(false)}>
                <Text style={styles.light}>Chiudi</Text>
              </Pressable>
            </View>
            <Text style={styles.muted}>I territori sono 32×32 e continuano oltre questi 25 riquadri. Seleziona un confine.</Text>
            <View testID="territory-map-grid" style={styles.worldMap}>
              {nearby.map(entry=>{
                const available=entry.owned||entry.reachable;
                const current=entry.key===world.active;
                const selectedTile=entry.key===selectedKey;
                return <Pressable key={entry.key} testID={"territory-map-cell-"+entry.key}
                  accessibilityRole="button"
                  accessibilityLabel={entry.owned?"Territorio posseduto "+entry.key:
                    entry.reachable?"Territorio espandibile "+entry.key:"Territorio inesplorato "+entry.key}
                  accessibilityState={{selected:selectedTile}}
                  disabled={!available} onPress={()=>setSelectedKey(entry.key)}
                  style={[styles.mapCell,!available&&styles.fogCell,
                    entry.owned&&styles.ownedCell,selectedTile&&styles.selectedCell,
                    current&&styles.currentCell]}>
                  <Text style={[styles.mapCellText,!available&&styles.fogText]}>
                    {current?"♜":entry.owned?"●":entry.reachable?"＋":"?"}
                  </Text>
                  <Text numberOfLines={1} style={styles.mapCoordinates}>{entry.tx},{entry.ty}</Text>
                </Pressable>;
              })}
            </View>
            <Text style={styles.landTitle}>{selected.owned?"Territorio del regno":"Da scoprire"}: {selected.label}</Text>
            <Text testID="territory-map-selected" style={styles.info}>
              {selected.owned?"Già acquisito · puoi visitarlo.":
                selected.reachable?"Acquisto: "+selected.cost+" monete · Difesa: "+selected.defense+
                  " · Forza militare: "+worldMilitaryStrength(world):"Non confinante con il regno."}
            </Text>
            <Text testID="territory-map-notice" style={styles.warningText}>{world.notice}</Text>
            <View style={styles.mapActions}>
              {selected.owned?<Pressable testID="territory-map-visit" accessibilityRole="button" style={styles.primary}
                onPress={()=>visit(selected.key)}><Text style={styles.light}>Visita</Text></Pressable>:
              selected.reachable?<>
                <Pressable testID="territory-map-buy" accessibilityRole="button"
                  accessibilityLabel={"Acquista territorio per "+selected.cost+" monete"}
                  onPress={()=>chooseExpansion("purchase")} style={styles.primary}>
                  <Text style={styles.light}>Acquista</Text>
                </Pressable>
                <Pressable testID="territory-map-conquer" accessibilityRole="button"
                  accessibilityLabel={"Conquista territorio, "+CONQUEST_GOLD_COST+" monete e "+CONQUEST_WOOD_COST+" legni"}
                  onPress={()=>chooseExpansion("conquest")} style={[styles.primary,styles.conquer]}>
                  <Text style={styles.light}>Conquista</Text>
                </Pressable>
              </>:null}
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={resetOpen} transparent animationType="fade" onRequestClose={()=>setResetOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard} testID="territory-reset-dialog">
            <Text style={styles.title}>Ricominciare?</Text>
            <Text style={styles.info}>Sostituisce soltanto il salvataggio Regno a territori. Le partite Avventura, Creativa e Regno a settori restano intatte.</Text>
            <View style={styles.mapActions}>
              <Pressable testID="territory-reset-cancel" accessibilityRole="button" style={styles.resetButton}
                onPress={()=>setResetOpen(false)}><Text style={styles.light}>Annulla</Text></Pressable>
              <Pressable testID="territory-reset-confirm" accessibilityRole="button" style={[styles.primary,styles.conquer]}
                onPress={reset}><Text style={styles.light}>Nuovo mondo casuale</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:"#10221b"},
  loading:{flex:1,alignItems:"center",justifyContent:"center"},
  header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",
    paddingHorizontal:8,paddingVertical:5,gap:7,borderBottomWidth:1,borderBottomColor:"#455c43"},
  headerCenter:{flex:1,alignItems:"center"},
  title:{fontSize:17,fontWeight:"800",color:"#fbf3db",textAlign:"center"},
  titleSmall:{fontSize:13},
  muted:{fontSize:10,color:"#bdcdb7",textAlign:"center"},
  light:{fontSize:12,fontWeight:"800",color:"#fff7dd",textAlign:"center"},
  back:{backgroundColor:"#314d3d",borderRadius:7,paddingHorizontal:10,paddingVertical:8,minHeight:36,justifyContent:"center"},
  resources:{flexDirection:"row",justifyContent:"space-around",gap:3,paddingVertical:7,backgroundColor:"#243b2c"},
  resource:{color:"#f1dfb8",fontWeight:"700",fontSize:10},
  territoryHeading:{flexDirection:"row",alignItems:"center",paddingHorizontal:8,paddingVertical:5,gap:8},
  landTitle:{fontSize:14,color:"#ffe1a0",fontWeight:"800"},
  mapButton:{backgroundColor:"#3e6650",borderRadius:8,paddingHorizontal:12,paddingVertical:11},
  mapArea:{flex:1,alignItems:"center",justifyContent:"center",minHeight:90},
  cameraRow:{minHeight:33,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:4,paddingHorizontal:5},
  cameraButton:{backgroundColor:"#355b47",minWidth:31,minHeight:31,alignItems:"center",justifyContent:"center",borderRadius:5},
  zoomButton:{backgroundColor:"#66563b",minWidth:30,minHeight:31,alignItems:"center",justifyContent:"center",borderRadius:5},
  rangeLabel:{color:"#dde6c6",fontSize:9,textAlign:"center",minWidth:70},
  toolScroll:{flexGrow:0,maxHeight:46},
  toolList:{paddingHorizontal:7,paddingVertical:5,gap:5,alignItems:"center"},
  toolButton:{backgroundColor:"#304a3d",borderRadius:8,minHeight:34,paddingHorizontal:10,justifyContent:"center"},
  toolActive:{backgroundColor:"#e2c17e"},
  toolLabel:{color:"#f3f0d8",fontWeight:"700",fontSize:11},
  toolActiveText:{color:"#26371f"},
  notice:{color:"#f0d78f",fontWeight:"600",fontSize:11,minHeight:34,paddingHorizontal:9,paddingTop:5},
  actions:{flexDirection:"row",gap:5,paddingHorizontal:8,paddingBottom:7},
  primary:{flex:1,backgroundColor:"#39734b",paddingHorizontal:9,paddingVertical:10,borderRadius:7,alignItems:"center",justifyContent:"center"},
  resetButton:{backgroundColor:"#38493e",paddingVertical:10,paddingHorizontal:9,borderRadius:7,justifyContent:"center"},
  overlay:{flex:1,backgroundColor:"rgba(0,0,0,0.83)",justifyContent:"center",alignItems:"center",padding:12},
  modalCard:{width:"100%",maxWidth:460,backgroundColor:"#1b3026",borderRadius:15,
    borderWidth:1,borderColor:"#c0a36f",padding:13,gap:10},
  modalHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  info:{color:"#d2e3d1",fontSize:12,lineHeight:18},
  warningText:{color:"#d7bc87",fontSize:11,minHeight:30},
  warning:{color:"#fca5a5",fontSize:10,padding:7,backgroundColor:"#632f2f"},
  worldMap:{flexDirection:"row",flexWrap:"wrap",gap:4,alignSelf:"center",justifyContent:"center",maxWidth:330},
  mapCell:{width:53,height:48,borderRadius:6,backgroundColor:"#487355",borderWidth:1,
    borderColor:"#759b79",alignItems:"center",justifyContent:"center"},
  ownedCell:{backgroundColor:"#5b7d4a"},
  fogCell:{backgroundColor:"#2b3a31",borderColor:"#394c42"},
  currentCell:{borderColor:"#ffdfa2",borderWidth:2},
  selectedCell:{borderColor:"#ffd064",borderWidth:3},
  mapCellText:{fontSize:18,fontWeight:"800",color:"#f5df9d"},
  fogText:{color:"#64746b"},
  mapCoordinates:{fontSize:9,color:"#e0edcf"},
  mapActions:{flexDirection:"row",gap:8,minHeight:39},
  conquer:{backgroundColor:"#8a5039"}
});
