import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import type { Character } from "../types";
import {
  GRID_SIZE,
  CELL_SIZE,
  CELL_GAP
} from "../constants";
import { isRiver } from "../game/terrain";
import { TopHud } from "../ui/TopHud";
import { BuildMenuModal } from "../ui/BuildMenuModal";
import { UnreachableModal } from "../ui/UnreachableModal";
import { InfoModal } from "../ui/InfoModal";
import { NavigationArrows } from "../ui/NavigationArrows";
import { useCamera } from "../camera/useCamera";
import { useCharacterMovement } from "../game/useCharacterMovement";
import { handleCallKing, handleCallFarmer, buildBridge, buildBridgeAt, buildLight } from "../game/actions";
import { GridRenderer, CharacterRenderer, BuildingRenderer } from "../components/GridRenderer";
import { useDragDetection } from "../hooks/useDragDetection";
import { useHouseAssignments } from "../hooks/useHouseAssignments";
import { useGameClock } from "../hooks/useGameClock";
import { useGameSelection } from "../hooks/useGameSelection";
import { useGameState } from "../hooks/useGameState";
import { useBuildActions } from "../hooks/useBuildActions";
import { useCellInteraction } from "../hooks/useCellInteraction";
import { useCharacterActions } from "../hooks/useCharacterActions";
import { resetGame } from "../game/reset";
import { styles } from "./GridGame.styles";

export default function GridGame() {
  // Stato mondo
  const gameState = useGameState();
  const [characters, setCharacters] = React.useState<Character[]>([]);
  
  // Selezioni
  const selection = useGameSelection();

  // Camera (gestita da hook dedicato)
  const gridPixelSize = useMemo(() => {
    const size = GRID_SIZE * CELL_SIZE;
    return { w: size, h: size };
  }, []);
  
  const camera = useCamera({
    gridWidth: gridPixelSize.w,
    gridHeight: gridPixelSize.h
  });
  
  const dragDetection = useDragDetection();
  const houseAssignments = useHouseAssignments();
  const gameClock = useGameClock();

  const reset = () => {
    resetGame({
      camera,
      setTrees: gameState.setTrees,
      setMines: gameState.setMines,
      setCharacters,
      resetWorld: gameState.resetWorld,
      resetSelections: () => {
        selection.setSelectedCharacter(null);
        selection.setSelectedBuilding(null);
        selection.setSelectedRiver(null);
      },
      resetClock: () => {
        gameClock.setGameTimeBaseMinutes(6 * 60);
        gameClock.gameTimeStartRef.current = Date.now();
        gameClock.setIsClockModalOpen(false);
        gameClock.setClockDraftMinutes(6 * 60);
      },
      resetHouseAssignments: houseAssignments.reset
    });
  };

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Usa hook per movimento personaggi
  useCharacterMovement({
    characters,
    setCharacters,
    bridges: gameState.bridges,
    trees: gameState.trees,
    mines: gameState.mines,
    kingGoingToCastle: gameState.kingGoingToCastle,
    setKingGoingToCastle: gameState.setKingGoingToCastle,
    farmerGoingToFarm: gameState.farmerGoingToFarm,
    setFarmerGoingToFarm: gameState.setFarmerGoingToFarm,
    kingPath: gameState.kingPath,
    setKingPath: gameState.setKingPath,
    farmerPath: gameState.farmerPath,
    setFarmerPath: gameState.setFarmerPath,
    setUnreachable: gameState.setUnreachable,
    isNight: gameClock.isNight,
    houseAssignments: houseAssignments.houseAssignments
  });

  // UI actions
  const characterActions = useCharacterActions({
    characters,
    bridges: gameState.bridges,
    trees: gameState.trees,
    mines: gameState.mines,
    setKingPath: gameState.setKingPath,
    setKingGoingToCastle: gameState.setKingGoingToCastle,
    setFarmerPath: gameState.setFarmerPath,
    setFarmerGoingToFarm: gameState.setFarmerGoingToFarm,
    setSelectedBuilding: selection.setSelectedBuilding,
    setSelectedRiver: selection.setSelectedRiver,
    setSelectedCharacter: selection.setSelectedCharacter,
    setUnreachable: gameState.setUnreachable
  });

  const buildActions = useBuildActions({
    selectedRiver: selection.selectedRiver,
    buildMode: gameState.buildMode,
    bridges: gameState.bridges,
    trees: gameState.trees,
    mines: gameState.mines,
    lights: gameState.lights,
    setBridges: gameState.setBridges,
    setLights: gameState.setLights,
    setSelectedRiver: selection.setSelectedRiver
  });

  const closeModal = () => {
    selection.closeModal();
    gameClock.setIsClockModalOpen(false);
  };

  const cellInteraction = useCellInteraction({
    buildMode: gameState.buildMode,
    isBridge: gameState.isBridge,
    buildLightFn: buildActions.buildLightFn,
    buildBridgeAtFn: buildActions.buildBridgeAtFn,
    selectRiver: selection.selectRiver,
    wasRecentlyDragging: () => dragDetection.wasRecentlyDragging(camera.isDragging)
  });


  return (
    <View style={styles.root}>
      <TopHud
        gameTime={gameClock.gameTime}
        buildMode={gameState.buildMode}
        onClockPress={() => {
          gameClock.setClockDraftMinutes((gameClock.gameTime.hours * 60 + gameClock.gameTime.minutes) % (24 * 60));
          gameClock.setIsClockModalOpen(true);
        }}
        onReset={reset}
        onBuildPress={() => gameState.setBuildMenuOpen(true)}
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
          <View style={[styles.grid, { width: gridPixelSize.w, height: gridPixelSize.h }, camera.gridStyle]}>
            <GridRenderer
              bridges={gameState.bridges}
              trees={gameState.trees}
              mines={gameState.mines}
              lights={gameState.lights}
              selectedRiver={selection.selectedRiver}
              buildMode={gameState.buildMode}
              gameTime={gameClock.gameTime}
              isDragging={camera.isDragging}
              onCellPress={cellInteraction.handleCellPress}
            />
            <View pointerEvents="box-none" style={{ position: "absolute", left: 0, top: 0, width: gridPixelSize.w, height: gridPixelSize.h, overflow: "hidden" }}>
              <BuildingRenderer isDragging={camera.isDragging} onPress={(b) => selection.openBuilding(b, () => dragDetection.wasRecentlyDragging(camera.isDragging))} />
              <CharacterRenderer characters={characters} isDragging={camera.isDragging} onPress={(c) => selection.openCharacter(c, () => dragDetection.wasRecentlyDragging(camera.isDragging))} />
            </View>
          </View>
        </View>
      </View>

      <UnreachableModal
        visible={gameState.unreachable.open}
        message={gameState.unreachable.message}
        onClose={() => gameState.setUnreachable({ open: false, message: "" })}
      />

      <BuildMenuModal
        visible={gameState.buildMenuOpen}
        onClose={() => gameState.setBuildMenuOpen(false)}
        onSelectLight={() => {
          gameState.setBuildMode("light");
          gameState.setBuildMenuOpen(false);
        }}
        onSelectBridge={() => {
          gameState.setBuildMode("bridge");
          gameState.setBuildMenuOpen(false);
        }}
        onCancel={() => {
          gameState.setBuildMode(null);
          gameState.setBuildMenuOpen(false);
        }}
      />

      <InfoModal
        visible={!!(selection.selectedCharacter || selection.selectedBuilding || selection.selectedRiver) || gameClock.isClockModalOpen}
        selectedCharacter={selection.selectedCharacter}
        selectedBuilding={selection.selectedBuilding}
        selectedRiver={selection.selectedRiver}
        isClockModalOpen={gameClock.isClockModalOpen}
        gameTime={gameClock.gameTime}
        clockDraftMinutes={gameClock.clockDraftMinutes}
        setClockDraftMinutes={gameClock.setClockDraftMinutes}
        setGameTimeBaseMinutes={gameClock.setGameTimeBaseMinutes}
        gameTimeStartRef={gameClock.gameTimeStartRef}
        setIsClockModalOpen={gameClock.setIsClockModalOpen}
        characters={characters}
        houseAssignments={houseAssignments.houseAssignments}
        assignedCharactersForHouse={houseAssignments.assignedCharactersForHouse}
        assignToHouse={houseAssignments.assignToHouse}
        isNight={gameClock.isNight}
        onCallKing={characterActions.handleCallKingFn}
        onCallFarmer={characterActions.handleCallFarmerFn}
        onBuildBridge={buildActions.buildBridgeFn}
        onClose={closeModal}
      />

      <NavigationArrows
        onUp={() => camera.pan(0, 50)}
        onDown={() => camera.pan(0, -50)}
        onLeft={() => camera.pan(50, 0)}
        onRight={() => camera.pan(-50, 0)}
      />
    </View>
  );
}
