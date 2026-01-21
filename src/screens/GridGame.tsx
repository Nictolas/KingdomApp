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
  
  const dragInfoRef = useRef<{ startX: number; startY: number; didDrag: boolean }>({ startX: 0, startY: 0, didDrag: false });
  const lastDragAtRef = useRef<number>(0);

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

  // Case: assegnazione abitanti (ogni casa può ospitare 2 persone)
  const [houseAssignments, setHouseAssignments] = useState<Record<string, number[]>>({
    "house-1": [],
    "house-2": [],
    "house-3": [],
    "house-4": []
  });

  const isBridge = (x: number, y: number) => bridges.some((b) => b.x === x && b.y === y);

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
    setHouseAssignments({ "house-1": [], "house-2": [], "house-3": [], "house-4": [] });

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

  const wasRecentlyDragging = () => {
    if (camera.isDragging) return true;
    if (dragInfoRef.current.didDrag) return true;
    return Date.now() - lastDragAtRef.current < 180;
  };
  
  // Wrapper per gestire dragInfoRef insieme alla camera
  const handleTouchStart = (e: any) => {
    const t = e.nativeEvent.touches;
    if (t.length === 1) {
      dragInfoRef.current = { startX: t[0].pageX, startY: t[0].pageY, didDrag: false };
    }
    camera.onTouchStart(e);
  };
  
  const handleTouchMove = (e: any) => {
    const t = e.nativeEvent.touches;
    if (t.length === 1 && camera.isDragging) {
      const dx = t[0].pageX - dragInfoRef.current.startX;
      const dy = t[0].pageY - dragInfoRef.current.startY;
      if (!dragInfoRef.current.didDrag && Math.hypot(dx, dy) > 6) dragInfoRef.current.didDrag = true;
    }
    camera.onTouchMove(e);
  };
  
  const handleTouchEnd = (e: any) => {
    camera.onTouchEnd(e);
    if (dragInfoRef.current.didDrag) lastDragAtRef.current = Date.now();
  };

  const handleMouseDownWrapper = (e: any) => {
    if (typeof window === "undefined") return;
    const ne = e?.nativeEvent;
    if (ne) {
      dragInfoRef.current = { startX: ne.clientX ?? 0, startY: ne.clientY ?? 0, didDrag: false };
    }
    camera.handleMouseDown(e);
  };
  
  const handleMouseMoveWrapper = (e: any) => {
    if (camera.isDragging) {
      const ne = e?.nativeEvent;
      if (ne) {
        const dx = ne.clientX - dragInfoRef.current.startX;
        const dy = ne.clientY - dragInfoRef.current.startY;
        if (!dragInfoRef.current.didDrag && Math.hypot(dx, dy) > 6) dragInfoRef.current.didDrag = true;
      }
    }
    camera.handleMouseMove(e);
  };
  
  const handleMouseUpWrapper = () => {
    camera.handleMouseUp();
    if (dragInfoRef.current.didDrag) lastDragAtRef.current = Date.now();
  };

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
    houseAssignments
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
    if (wasRecentlyDragging()) return;
    setSelectedCharacter(char);
    setSelectedBuilding(null);
    setSelectedRiver(null);
    await Haptics.selectionAsync();
  };

  const openBuilding = async (b: Building) => {
    if (wasRecentlyDragging()) return;
    setSelectedBuilding(b);
    setSelectedCharacter(null);
    setSelectedRiver(null);
    await Haptics.selectionAsync();
  };

  const selectRiver = async (x: number, y: number) => {
    if (wasRecentlyDragging()) return;
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

  const assignedCharactersForHouse = (houseId: string) => houseAssignments[houseId] ?? [];
  const assignToHouse = (houseId: string, charId: number | null) => {
    setHouseAssignments((prev) => {
      const current = prev[houseId] ?? [];
      if (charId === null) {
        return { ...prev, [houseId]: [] };
      }
      if (current.includes(charId)) {
        return { ...prev, [houseId]: current.filter((id) => id !== charId) };
      }
      if (current.length >= 2) {
        return prev;
      }
      return { ...prev, [houseId]: [...current, charId] };
    });
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
        onResponderGrant={handleTouchStart}
        onResponderMove={handleTouchMove}
        onResponderRelease={handleTouchEnd}
        onResponderTerminate={handleTouchEnd}
        // @ts-ignore
        onMouseDown={handleMouseDownWrapper}
        // @ts-ignore
        onMouseMove={handleMouseMoveWrapper}
        // @ts-ignore
        onMouseUp={handleMouseUpWrapper}
        // @ts-ignore
        onMouseLeave={handleMouseUpWrapper}
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
              onCharacterPress={openCharacter}
              onBuildingPress={openBuilding}
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
        houseAssignments={houseAssignments}
        assignedCharactersForHouse={assignedCharactersForHouse}
        assignToHouse={assignToHouse}
        isNight={isNight}
        onCallKing={handleCallKingFn}
        onCallFarmer={handleCallFarmerFn}
        onBuildBridge={buildBridgeFn}
        onClose={closeModal}
      />
    </View>
  );
}
