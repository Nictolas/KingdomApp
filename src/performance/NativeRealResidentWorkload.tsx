import React, { memo, useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MapWandererCharacter } from "../components/MapWandererCharacter";
import {
  getOrologioSimTimeScaleSnapshot,
  subscribeOrologioGiocoInPausa,
  subscribeOrologioGiocoVelocita
} from "../game/orologioGiocoSession";
import {
  createNativeRealFixtureResidents,
  createNativeRealFixtureCommutePath,
  NativeRealFixtureOccupancy,
  NativeRealFixtureSelection,
  type NativeRealFixtureResident,
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
 * Each resident receives stable occupancy and touch callbacks. A touch must
 * not render the other 199 resident wrappers or invalidate their memoized
 * native bodies. Population changes still remount the isolated fixture.
 */
const NativeRealFixtureSprite = memo(function NativeRealFixtureSprite({
  resident,
  occupancy,
  selection,
  moving,
  deterministicCommute,
  cellSizePx
}: {
  resident: NativeRealFixtureResident;
  occupancy: NativeRealFixtureOccupancy;
  selection: NativeRealFixtureSelection;
  moving: boolean;
  deterministicCommute: boolean;
  cellSizePx: number;
}) {
  const id = resident.instanceId;
  // State is local to this resident: a completed leg never rerenders the
  // other 199 sprites. The fixture is remounted on mode/population changes.
  const [returning, setReturning] = useState(false);
  const commutePath = useMemo(() => deterministicCommute && moving
    ? createNativeRealFixtureCommutePath(resident, returning) : null,
    [deterministicCommute, moving, resident, returning]);
  const onCommuteComplete = useCallback(() => setReturning(value => !value), []);
  const onSelect = useCallback(() => selection.select(id), [selection, id]);
  const isCellFreeForMe = useCallback((cell: number) => occupancy.isFreeFor(id, cell), [occupancy, id]);
  const tryClaimCell = useCallback((cell: number) => occupancy.tryClaim(id, cell), [occupancy, id]);
  const releaseMyCell = useCallback(() => occupancy.release(id), [occupancy, id]);
  const onCellSettled = useCallback((cell: number) => occupancy.settledAt(id, cell), [occupancy, id]);

  return (
    <MapWandererCharacter
      instanceId={id}
      cols={NATIVE_REAL_FIXTURE_COLS}
      rows={NATIVE_REAL_FIXTURE_ROWS}
      cellSizePx={cellSizePx}
      isWalkable={isWalkableInFixture}
      isRoadCell={isRoadInFixture}
      preferredSpawnCell={resident.spawnCell}
      disableIdleRoam={!moving || deterministicCommute}
      commutePath={commutePath}
      commuteToken={returning ? 1 : 0}
      commutePurpose={commutePath ? "work" : null}
      onCommuteComplete={commutePath ? onCommuteComplete : undefined}
      onPress={onSelect}
      onDoublePress={onSelect}
      pressAccessibilityLabel={"Seleziona residente di prova " + id}
      isCellFreeForMe={isCellFreeForMe}
      tryClaimCell={tryClaimCell}
      releaseMyCell={releaseMyCell}
      onCellSettled={onCellSettled}
    />
  );
});

/** Only this overlay rerenders when a resident is tapped or the clock changes. */
const NativeFixtureStatus = memo(function NativeFixtureStatus({
  population,
  moving,
  deterministicCommute,
  selection
}: {
  population: NativeTestPopulation;
  moving: boolean;
  deterministicCommute: boolean;
  selection: NativeRealFixtureSelection;
}) {
  const selected = useSyncExternalStore(
    selection.subscribe,
    selection.getSnapshot,
    selection.getSnapshot
  );
  const timeScale = useSyncExternalStore(
    subscribeTimeScale,
    getOrologioSimTimeScaleSnapshot,
    getOrologioSimTimeScaleSnapshot
  );
  return (
    <View style={styles.status} pointerEvents="none">
      <Text style={styles.statusText}>
        Sprite reali · {population} abitanti · {moving ? (deterministicCommute ? "tragitto ripetibile" : "girovaghi") : "fermi"} · tempo {timeScale}×
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
  );
});

/**
 * Actual native resident renderer on an isolated 20×20 fixture. This is NOT
 * a full kingdom simulation: no AI, buildings, jobs, GameContext or saves.
 * Clock is observed, never modified. Touch status and clock subscriptions
 * stay outside the 200-sprite subtree to avoid measurement contamination.
 */
export const NativeRealResidentWorkload = memo(function NativeRealResidentWorkload({
  population,
  moving,
  deterministicCommute = false,
  width,
  height
}: {
  population: NativeTestPopulation;
  moving: boolean;
  deterministicCommute?: boolean;
  width: number;
  height: number;
}) {
  const residents = useMemo(() => createNativeRealFixtureResidents(population), [population]);
  const occupancy = useMemo(() => new NativeRealFixtureOccupancy(), [population]);
  const selection = useMemo(() => new NativeRealFixtureSelection(), [population]);
  const cellSizePx = Math.min(width / NATIVE_REAL_FIXTURE_COLS, height / NATIVE_REAL_FIXTURE_ROWS);

  if (!Number.isFinite(cellSizePx) || cellSizePx <= 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {residents.map(resident => (
        <NativeRealFixtureSprite
          key={resident.instanceId}
          resident={resident}
          occupancy={occupancy}
          selection={selection}
          moving={moving}
          deterministicCommute={deterministicCommute}
          cellSizePx={cellSizePx}
        />
      ))}
      <NativeFixtureStatus population={population} moving={moving} deterministicCommute={deterministicCommute} selection={selection} />
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
