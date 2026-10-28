import React, { memo, useMemo, useState, useSyncExternalStore } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MapWandererCharacter } from "../components/MapWandererCharacter";
import {
  getOrologioSimTimeScaleSnapshot,
  subscribeOrologioGiocoInPausa,
  subscribeOrologioGiocoVelocita
} from "../game/orologioGiocoSession";
import {
  createNativeRealFixtureResidents,
  NativeRealFixtureOccupancy,
  NATIVE_REAL_FIXTURE_COLS,
  NATIVE_REAL_FIXTURE_ROWS
} from "./nativeRealResidentFixture";
import type { NativeTestPopulation } from "./nativePopulationFixture";

const isWalkableInFixture = (cell: number) =>
  Number.isInteger(cell) && cell >= 0 &&
  cell < NATIVE_REAL_FIXTURE_COLS * NATIVE_REAL_FIXTURE_ROWS;
const isRoadInFixture = (_cell: number) => false;

function subscribeTimeScale(listener: () => void): () => void {
  const unsubscribePause = subscribeOrologioGiocoInPausa(listener);
  const unsubscribeSpeed = subscribeOrologioGiocoVelocita(listener);
  return () => {
    unsubscribePause();
    unsubscribeSpeed();
  };
}

/**
 * The same MapWandererCharacter used by the real native map, but with a local
 * 20x20 grid, local simulated owners and no GameContext or persistence.
 *
 * This is deliberately NOT a full kingdom simulation: no jobs, pathfinding,
 * buildings, game-state writes or citizen lifecycle. Its value is exercising
 * the actual sprite-sheet rendering, press targets, idle/collision timers and
 * shared movement scheduler with up to 200 native character bodies.
 *
 * The game clock is read, never changed. When game setup has locked time,
 * residents remain still; the UI explicitly tells testers not to interpret
 * this as a successful moving-sprite test.
 */
export const NativeRealResidentWorkload = memo(function NativeRealResidentWorkload({
  population,
  moving,
  width,
  height
}: {
  population: NativeTestPopulation;
  moving: boolean;
  width: number;
  height: number;
}) {
  const residents = useMemo(() => createNativeRealFixtureResidents(population), [population]);
  const occupancy = useMemo(() => new NativeRealFixtureOccupancy(), [population]);
  const [selected, setSelected] = useState<number | null>(null);
  const timeScale = useSyncExternalStore(
    subscribeTimeScale,
    getOrologioSimTimeScaleSnapshot,
    getOrologioSimTimeScaleSnapshot
  );
  const cellSizePx = Math.min(width / NATIVE_REAL_FIXTURE_COLS, height / NATIVE_REAL_FIXTURE_ROWS);

  if (!Number.isFinite(cellSizePx) || cellSizePx <= 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {residents.map(resident => (
        <MapWandererCharacter
          key={resident.instanceId}
          instanceId={resident.instanceId}
          cols={NATIVE_REAL_FIXTURE_COLS}
          rows={NATIVE_REAL_FIXTURE_ROWS}
          cellSizePx={cellSizePx}
          isWalkable={isWalkableInFixture}
          isRoadCell={isRoadInFixture}
          preferredSpawnCell={resident.spawnCell}
          disableIdleRoam={!moving}
          onPress={() => setSelected(resident.instanceId)}
          onDoublePress={() => setSelected(resident.instanceId)}
          pressAccessibilityLabel={"Seleziona residente di prova " + resident.instanceId}
          isCellFreeForMe={cell => occupancy.isFreeFor(resident.instanceId, cell)}
          tryClaimCell={cell => occupancy.tryClaim(resident.instanceId, cell)}
          releaseMyCell={() => occupancy.release(resident.instanceId)}
          onCellSettled={cell => occupancy.settledAt(resident.instanceId, cell)}
        />
      ))}
      <View style={styles.status} pointerEvents="none">
        <Text style={styles.statusText}>
          Sprite reali · {population} abitanti · {moving ? "girovaghi" : "fermi"} · tempo {timeScale}×
        </Text>
        {moving && timeScale === 0 && (
          <Text style={styles.warning}>
            Simulazione in pausa: riprendi il gioco sulla mappa per misurare il movimento.
          </Text>
        )}
        {selected !== null && (
          <Text style={styles.statusText}>Tocco su residente di prova {selected}</Text>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  status: {
    position: "absolute",
    left: 4,
    bottom: 4,
    backgroundColor: "rgba(10,21,35,0.85)",
    paddingHorizontal: 5,
    paddingVertical: 3,
    maxWidth: "70%"
  },
  statusText: { color: "#fff", fontSize: 10 },
  warning: { color: "#ffd88a", fontSize: 10 }
});
