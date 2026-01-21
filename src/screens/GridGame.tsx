import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import type { Point, Placed, Bridge, Light, Building, Character } from "../types";
import {
  GRID_SIZE,
  CELL_SIZE,
  CELL_GAP
} from "../constants";
import { generateTrees, generateMines, generateCharacters } from "../game/generation";
import { isRiver } from "../game/terrain";
import { TopHud } from "../ui/TopHud";
import { BuildMenuModal } from "../ui/BuildMenuModal";
import { UnreachableModal } from "../ui/UnreachableModal";
import { InfoModal } from "../ui/InfoModal";
import { useCamera } from "../camera/useCamera";
import { useCharacterMovement } from "../game/useCharacterMovement";
import { handleCallKing, handleCallFarmer, buildBridge, buildBridgeAt, buildLight } from "../game/actions";
import { GridRenderer, CharacterRenderer, BuildingRenderer } from "../components/GridRenderer";
import { useDragDetection } from "../hooks/useDragDetection";
import { useHouseAssignments } from "../hooks/useHouseAssignments";
import { styles } from "./GridGame.styles";

export default function GridGame() {
  // Stato mondo
  const [bridges, setBridges] = useState<Bridge[]>([]);
  const [trees, setTrees] = useState<Placed[]>([]);
  const [mines, setMines] = useState<Placed[]>([]);
  const [lights, setLights] = useState<Light[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  
  // Modalità costruzione
  const [buildMode, setBuildMode] = useState<"light" | "bridge" | null>(null);
  const [buildMenuOpen, setBuildMenuOpen] = useState(false);

  // Selezioni
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [selectedRiver, setSelectedRiver] = useState<Point | null>(null);

  // Camera (gestita da hook dedicato)
  const gridPixelSize = useMemo(() => {
    const size = GRID_SIZE * (CELL_SIZE + CELL_GAP);
    return { w: size, h: size };
  }, []);
  
  const camera = useCamera({
    gridWidth: gridPixelSize.w,
    gridHeight: gridPixelSize.h
  });
  
  const dragDetection = useDragDetection();
  const houseAssignments = useHouseAssignments();

  // Azioni "story"
  const [kingGoingToCastle, setKingGoingToCastle] = useState(false);
  const [farmerGoingToFarm, setFarmerGoingToFarm] = useState(false);
  const [kingPath, setKingPath] = useState<Point[]>([]);
  const [farmerPath, setFarmerPath] = useState<Point[]>([]);

  // Dialog irraggiungibile (riuso)
  const [unreachable, setUnreachable] = useState<{ open: boolean; message: string }>({ open: false, message: "" });

  // Orologio di gioco (1 secondo reale = 1 minuto di gioco)
  const [gameTime, setGameTime] = useState({ hours: 6, minutes: 0 });
  const gameTimeStartRef = useRef<number>(Date.now());
  const [gameTimeBaseMinutes, setGameTimeBaseMinutes] = useState(6 * 60);
  const [isClockModalOpen, setIsClockModalOpen] = useState(false);
  const [clockDraftMinutes, setClockDraftMinutes] = useState(6 * 60);


  const isBridge = (x: number, y: number) => bridges.some((b: Bridge) => b.x === x && b.y === y);

  const formatGameTime = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const isNight = useMemo(() => {
    const t = gameTime.hours * 60 + gameTime.minutes;
    return t >= 18 * 60 || t < 6 * 60;
  }, [gameTime]);

  const reset = () => {
    setSelectedCharacter(null);
    setSelectedBuilding(null);
    setSelectedRiver(null);
    setUnreachable({ open: false, message: "" });
    const { width, height } = Dimensions.get("window");
    camera.zoomToPoint(width / 2, height / 2, 1);
    setKingGoingToCastle(false);
    setFarmerGoingToFarm(false);
    setKingPath([]);
    setFarmerPath([]);
    setBridges([]);
    setLights([]);
    setBuildMode(null);
    setIsClockModalOpen(false);
    setGameTimeBaseMinutes(6 * 60);
    gameTimeStartRef.current = Date.now();
    houseAssignments.reset();

    const newTrees = generateTrees();
    const newMines = generateMines();
    setTrees(newTrees);
    setMines(newMines);
    setCharacters(generateCharacters(newTrees, newMines));
  };

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Orologio: 1s reale = 1 min gioco
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - gameTimeStartRef.current) / 1000);
      const totalMinutes = gameTimeBaseMinutes + elapsedSeconds;
      const hours = Math.floor(totalMinutes / 60) % 24;
      const minutes = totalMinutes % 60;
      setGameTime({ hours, minutes });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameTimeBaseMinutes]);


  // Usa hook per movimento personaggi
  useCharacterMovement({
    characters,
    setCharacters,
    bridges,
    trees,
    mines,
    kingGoingToCastle,
    setKingGoingToCastle,
    farmerGoingToFarm,
    setFarmerGoingToFarm,
    kingPath,
    setKingPath,
    farmerPath,
    setFarmerPath,
    setUnreachable,
    isNight,
    houseAssignments: houseAssignments.houseAssignments
  });

  // UI actions
  const handleCallKingFn = handleCallKing(
    characters,
    bridges,
    trees,
    mines,
    setKingPath,
    setKingGoingToCastle,
    setSelectedBuilding,
    setSelectedRiver,
    setSelectedCharacter,
    setUnreachable
  );

  const handleCallFarmerFn = handleCallFarmer(
    characters,
    bridges,
    trees,
    mines,
    setFarmerPath,
    setFarmerGoingToFarm,
    setSelectedBuilding,
    setSelectedRiver,
    setSelectedCharacter,
    setUnreachable
  );

  const handleZoomIn = async () => {
    const { width, height } = Dimensions.get("window");
    camera.zoomIncrement(width / 2, height / 2, 0.2);
    await Haptics.selectionAsync();
  };
  const handleZoomOut = async () => {
    const { width, height } = Dimensions.get("window");
    camera.zoomIncrement(width / 2, height / 2, -0.2);
    await Haptics.selectionAsync();
  };

  const openCharacter = async (char: Character) => {
    if (dragDetection.wasRecentlyDragging(camera.isDragging)) return;
    setSelectedCharacter(char);
    setSelectedBuilding(null);
    setSelectedRiver(null);
    await Haptics.selectionAsync();
  };

  const openBuilding = async (b: Building) => {
    if (dragDetection.wasRecentlyDragging(camera.isDragging)) return;
    setSelectedBuilding(b);
    setSelectedCharacter(null);
    setSelectedRiver(null);
    await Haptics.selectionAsync();
  };

  const selectRiver = async (x: number, y: number) => {
    if (dragDetection.wasRecentlyDragging(camera.isDragging)) return;
    if (!isRiver(x, y) || isBridge(x, y)) return;
    setSelectedRiver({ x, y });
    setSelectedBuilding(null);
    setSelectedCharacter(null);
    await Haptics.selectionAsync();
  };

  const buildBridgeFn = buildBridge(selectedRiver, setBridges, setSelectedRiver);
  const buildBridgeAtFn = (x: number, y: number) => buildBridgeAt(x, y, setBridges)();
  const buildLightFn = (x: number, y: number) => buildLight(x, y, buildMode, trees, mines, lights, setLights)();

  const closeModal = () => {
    setSelectedCharacter(null);
    setSelectedBuilding(null);
    setSelectedRiver(null);
    setIsClockModalOpen(false);
  };

  const handleCellPress = (x: number, y: number) => {
    if (buildMode === "light") {
      buildLightFn(x, y);
    } else if (buildMode === "bridge") {
      const river = isRiver(x, y);
      const bridge = isBridge(x, y);
      if (river && !bridge) {
        buildBridgeAtFn(x, y);
      }
    } else {
      const river = isRiver(x, y);
      const bridge = isBridge(x, y);
      if (river && !bridge) {
        selectRiver(x, y);
      }
    }
  };


  return (
    <View style={styles.root}>
      <TopHud
        gameTime={gameTime}
        buildMode={buildMode}
        onClockPress={() => {
          setClockDraftMinutes((gameTime.hours * 60 + gameTime.minutes) % (24 * 60));
          setIsClockModalOpen(true);
        }}
        onReset={reset}
        onBuildPress={() => setBuildMenuOpen(true)}
        onZoomOut={handleZoomOut}
        onZoomIn={handleZoomIn}
      />

      <View
        style={styles.stage}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e: any) => dragDetection.handleTouchStart(e, camera.onTouchStart)}
        onResponderMove={(e: any) => dragDetection.handleTouchMove(e, camera.isDragging, camera.onTouchMove)}
        onResponderRelease={(e: any) => dragDetection.handleTouchEnd(e, camera.onTouchEnd)}
        onResponderTerminate={(e: any) => dragDetection.handleTouchEnd(e, camera.onTouchEnd)}
        // @ts-ignore
        onMouseDown={(e) => dragDetection.handleMouseDown(e, camera.handleMouseDown)}
        // @ts-ignore
        onMouseMove={(e) => dragDetection.handleMouseMove(e, camera.isDragging, camera.handleMouseMove)}
        // @ts-ignore
        onMouseUp={() => dragDetection.handleMouseUp(camera.handleMouseUp)}
        // @ts-ignore
        onMouseLeave={() => dragDetection.handleMouseUp(camera.handleMouseUp)}
        // @ts-ignore
        onWheel={camera.handleWheel}
      >
        <View style={[styles.world, camera.worldStyle]}>
          <View style={[styles.grid, { width: gridPixelSize.w, height: gridPixelSize.h }]}>
            <GridRenderer
              bridges={bridges}
              trees={trees}
              mines={mines}
              lights={lights}
              selectedRiver={selectedRiver}
              buildMode={buildMode}
              gameTime={gameTime}
              isDragging={camera.isDragging}
              onCellPress={handleCellPress}
            />
          </View>
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <BuildingRenderer isDragging={camera.isDragging} onPress={openBuilding} />
            <CharacterRenderer characters={characters} isDragging={camera.isDragging} onPress={openCharacter} />
          </View>
        </View>
      </View>

      <UnreachableModal
        visible={unreachable.open}
        message={unreachable.message}
        onClose={() => setUnreachable({ open: false, message: "" })}
      />

      <BuildMenuModal
        visible={buildMenuOpen}
        onClose={() => setBuildMenuOpen(false)}
        onSelectLight={() => {
          setBuildMode("light");
          setBuildMenuOpen(false);
        }}
        onSelectBridge={() => {
          setBuildMode("bridge");
          setBuildMenuOpen(false);
        }}
        onCancel={() => {
          setBuildMode(null);
          setBuildMenuOpen(false);
        }}
      />

      <InfoModal
        visible={!!(selectedCharacter || selectedBuilding || selectedRiver) || isClockModalOpen}
        selectedCharacter={selectedCharacter}
        selectedBuilding={selectedBuilding}
        selectedRiver={selectedRiver}
        isClockModalOpen={isClockModalOpen}
        gameTime={gameTime}
        clockDraftMinutes={clockDraftMinutes}
        setClockDraftMinutes={setClockDraftMinutes}
        setGameTimeBaseMinutes={setGameTimeBaseMinutes}
        gameTimeStartRef={gameTimeStartRef}
        setIsClockModalOpen={setIsClockModalOpen}
        characters={characters}
        houseAssignments={houseAssignments.houseAssignments}
        assignedCharactersForHouse={houseAssignments.assignedCharactersForHouse}
        assignToHouse={houseAssignments.assignToHouse}
        isNight={isNight}
        onCallKing={handleCallKingFn}
        onCallFarmer={handleCallFarmerFn}
        onBuildBridge={buildBridgeFn}
        onClose={closeModal}
      />
    </View>
  );
}
