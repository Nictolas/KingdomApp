import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { getOrologioGiocoInPausaSnapshot, getOrologioSimTimeScaleSnapshot } from "../game/orologioGiocoSession";
import { NativeResidentSegmentRunner } from "../performance/nativeResidentSegmentRunner";
import { beginNativeResidentDispatch, endNativeResidentDispatch } from "../performance/nativeResidentDispatchProfiler";
import { PendingCommuteRetry } from "../game/pendingCommuteRetry";
import { NativeResidentCollisionRetry } from "../performance/nativeResidentCollisionRetry";
import { NativeResidentRouteEpoch } from "../performance/nativeResidentRouteEpoch";
import { NativeResidentOwnedTimer } from "../performance/nativeResidentOwnedTimer";
import { nativeResidentRouteMode, nativeResidentHomeTransition, nativeResidentShouldRearmIdle, nativeResidentReconcileInterruptedClaim, nativeResidentReleaseMismatchedRouteOrigin, nativeResidentReleaseSharedHomeArrival } from "../performance/nativeResidentRouteTransitions";
import { markNativeResidentFrameCallback, markNativeResidentRenderInvocation, markNativeResidentWrapperInvocation } from "../performance/nativeResidentWorkCounters";
import { NativeResidentCallbackRelay } from "../performance/nativeResidentCallbackRelay";
import { NativeResidentTapRecognizer } from "../performance/nativeResidentTapRecognizer";
import { NativeResidentNeighborSampler } from "../performance/nativeResidentNeighborSampler";
import { nativeResidentSpawnSampler } from "../performance/nativeResidentSpawnSampler";
import { NativeResidentSpriteFrameDriver } from "../performance/nativeResidentSpriteFrameDriver";
import { nativeResidentNeedsTouchRender } from "../performance/nativeResidentTouchRenderGate";
import {
  requestResidentAnimationFrame,
  subscribeResidentAnimationFrames,
  cancelResidentAnimationFrame,
  isNativeResidentFrameBusActive,
  subscribeNativeResidentFrameBusActivity
} from "../performance/nativeResidentFrameBus";
import { ensureNativeResidentFrameLifecycle } from "../performance/nativeResidentFrameLifecycle.native";
import { scheduleNativeResidentTimer, cancelNativeResidentTimer } from "../performance/nativeResidentTimerQueue";
import { segmentMoveDurationMs, type WanderDirection } from "../game/mapWandererMotion";

/**
 * Keep the native hit target animated together with the sprite. Unlike React
 * state-based coordinates, Animated.ValueXY.setValue updates positions without
 * reconciling the entire character component on every animation frame.
 * We deliberately retain the existing JS RAF clock and gameplay callbacks.
 */
// Module-wide lifecycle registration (one subscription for all residents).
ensureNativeResidentFrameLifecycle();

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);


const CHARACTER_SHEET = require("../../assets/tilesets/DEMO-vector-rpg-overworld-tileset/character.png");

/** Nel foglio ogni frame è 64×64 px; 12 frame in fila (Sud, NE, Nord, SE). */
const FRAME_PX = 64;
const FRAMES = 12;

/** Pausa tra i passi del girovago. */
const IDLE_BEFORE_NEXT_MS = 2200;
/** Retry più rapido se la cella davanti è occupata durante una commute. */
const CLAIM_RETRY_MS = 900;
/** Dopo N fallimenti di claim, chiede al genitore un nuovo percorso. */
const MAX_CLAIM_FAILS_BEFORE_REPATH = 3;

function directionBetween(from: number, to: number, cols: number): WanderDirection {
  if (to === from + 1) return "e";
  if (to === from - 1) return "w";
  if (to === from - cols) return "n";
  if (to === from + cols) return "s";
  return "s";
}

type MapWandererCharacterProps = {
  cols: number;
  rows: number;
  cellSizePx: number;
  isWalkable: (cellIndex: number) => boolean;
  /** Se la cella è strada, il passo tra celle adiacenti è più rapido. */
  isRoadCell?: (cellIndex: number) => boolean;
  /** Per più personaggi sulla stessa mappa: spawn e z-index distinti. */
  instanceId?: number;
  /**
   * Se impostato, il personaggio resta fermo su quella cella (idle), senza camminare.
   * Usato di notte sulla cella della residenza; z-index sotto gli edifici per effetto “dentro casa”.
   */
  fixedCell?: number | null;
  /**
   * Cella preferita al primo spawn / dopo un remount (ultima posizione nota o casa).
   * Evita teletrasporti casuali sulla mappa.
   */
  preferredSpawnCell?: number | null;
  /**
   * Percorso determinato (celle inclusive). Se length ≥ 2, ha priorità su girovago e fixedCell.
   * Il genitore incrementa `commuteToken` per forzare un nuovo run con lo stesso path se serve.
   */
  commutePath?: number[] | null;
  commuteToken?: number;
  commutePurpose?: "work" | "bar" | "home" | "mensa" | "culto" | "negozio" | "rapina" | "cerca_lavoro" | null;
  onCommuteComplete?: (purpose: "work" | "bar" | "home" | "mensa" | "culto" | "negozio" | "rapina" | "cerca_lavoro") => void;
  /**
   * Coda bloccata (cella occupata): il genitore dovrebbe ripianificare da `fromCell`
   * evitando gli altri abitanti.
   */
  onCommuteBlocked?: (info: {
    fromCell: number;
    blockedCell: number;
    purpose: "work" | "bar" | "home" | "mensa" | "culto" | "negozio" | "rapina" | "cerca_lavoro";
  }) => void;
  /** Chiamato quando il personaggio “arriva” su una cella (fine passo o snap). */
  onCellSettled?: (cellIndex: number) => void;
  /** Singolo tocco: seleziona l’abitante (sintesi in barra mappa). */
  onPress?: () => void;
  /** Doppio tocco: apre la scheda abitante completa. */
  onDoublePress?: () => void;
  /**
   * Se true per la cella corrente, il personaggio non intercetta i tocchi: passano alla griglia sotto
   * (es. doppio tap sulla residenza → elenco in casa invece della scheda abitante).
   */
  passTouchesToMapOnCell?: (cellIndex: number) => boolean;
  /** Se true, niente passeggio casuale tra le celle (solo percorsi commute / notte in casa). */
  disableIdleRoam?: boolean;
  /** Etichetta accessibilità per il target tocco (es. nome abitante). */
  pressAccessibilityLabel?: string;
  /** Etichetta accessibilità alternativa (doppio tocco / legacy). */
  doubleTapAccessibilityLabel?: string;
  /** Se impostata, mostra questa emoji al posto dello sprite RPG (es. Golem 🗿). */
  markerEmoji?: string | null;
  /**
   * Occupancy: evita che due personaggi condividano la stessa casella mentre camminano.
   * `isCellFreeForMe` = libera o già mia; `tryClaimCell` prenota atomicamente; `releaseMyCell` in uscita.
   */
  isCellFreeForMe?: (cellIndex: number) => boolean;
  tryClaimCell?: (cellIndex: number) => boolean;
  releaseMyCell?: () => void;
};

/**
 * Personaggio da `character.png`: spostamento fluido tra celle, camminata solo durante il movimento,
 * idle sul primo frame a riposo; sprite più alto della cella, piedi sulla casella.
 */
function NativeResidentBody({
  cols,
  rows,
  cellSizePx,
  isWalkable,
  isRoadCell,
  instanceId = 0,
  fixedCell = null,
  preferredSpawnCell = null,
  commutePath = null,
  commuteToken = 0,
  commutePurpose = null,
  onCommuteComplete,
  onCommuteBlocked,
  onCellSettled,
  onPress,
  onDoublePress,
  passTouchesToMapOnCell,
  disableIdleRoam = false,
  pressAccessibilityLabel,
  doubleTapAccessibilityLabel,
  markerEmoji = null,
  isCellFreeForMe,
  tryClaimCell,
  releaseMyCell
}: MapWandererCharacterProps) {
  if (__DEV__) markNativeResidentRenderInvocation();
  const [logicalCell, setLogicalCell] = useState<number | null>(null);
  const cellRef = useRef<number | null>(null);
  // Stable position observable: movement no longer causes React rerenders 60×/s.
  const [pixelPos] = useState(() => new Animated.ValueXY({ x: 0, y: 0 }));
  // Sprite-sheet frames are written to Animated.Image without React renders.
  // The independent native hit target still follows pixelPos as before.
  const [spriteSheetOffset] = useState(() => new Animated.Value(0));
  const [spriteMirrorScaleX] = useState(() => new Animated.Value(1));
  const [spriteFrames] = useState(() =>
    new NativeResidentSpriteFrameDriver(
      cellSizePx,
      (left) => spriteSheetOffset.setValue(left),
      (scaleX) => spriteMirrorScaleX.setValue(scaleX)
    )
  );
  const face = useCallback((next: WanderDirection) => {
    // Facing changes do not reconcile 200 React sprite bodies; the image
    // frame and horizontal mirror are updated by their Animated.Values.
    spriteFrames.face(next);
  }, [spriteFrames]);
  React.useLayoutEffect(() => {
    spriteFrames.setCellSize(cellSizePx);
  }, [spriteFrames, cellSizePx]);

  const inited = useRef(false);
  const isMovingRef = useRef(false);
  const prevFixedCellRef = useRef<number | null | undefined>(undefined);
  const routeMode = nativeResidentRouteMode(commutePath, fixedCell);
  const previousIdleContextRef = useRef({ routeMode, disableIdleRoam });
  // Shared timer queue manages deadlines; this per-resident slot protects
  // against canceled callbacks that arrive late after a route/mode change.
  const [wakeTimer] = useState(() =>
    new NativeResidentOwnedTimer(scheduleNativeResidentTimer, cancelNativeResidentTimer)
  );
  /** Collision retry can be suspended across pauses without repeated timers. */
  const [pendingCommuteRetry] = useState(() => new PendingCommuteRetry());
  // A single mutable point per mounted native resident is read synchronously
  // by Animated.ValueXY.setValue; no new point on each animation frame.
  const [movementPoint] = useState(() => ({ x: 0, y: 0 }));
  const [motion] = useState(() => new NativeResidentSegmentRunner({
    requestFrame: requestResidentAnimationFrame,
    subscribeFrame: subscribeResidentAnimationFrames,
    cancelFrame: cancelResidentAnimationFrame,
    readTimeScale: getOrologioSimTimeScaleSnapshot,
    writePositionXY: (x, y) => {
      movementPoint.x = x;
      movementPoint.y = y;
      pixelPos.setValue(movementPoint);
    },
    advanceSprite: (elapsedMs) => spriteFrames.advanceElapsed(elapsedMs),
    setWalking: (moving) => {
      isMovingRef.current = moving;
      spriteFrames.setMoving(moving);
    },
    // No per-resident diagnostic closure or callback invocation in production.
    // In development the counter itself is inert while the HUD is closed.
    onFrame: __DEV__ ? markNativeResidentFrameCallback : undefined
  }));
  const [tapRecognizer] = useState(() => new NativeResidentTapRecognizer());
  // One four-cell scratch buffer per resident; no neighbor/filter arrays on idle retries.
  const [neighborSampler] = useState(() => new NativeResidentNeighborSampler());
  /** Evita di rieseguire effetti a ogni render (es. tick orologio sul genitore → callback nuove). */
  const onCommuteCompleteRef = useRef(onCommuteComplete);
  const onCommuteBlockedRef = useRef(onCommuteBlocked);
  const onCellSettledRef = useRef(onCellSettled);
  const pickNextMoveRef = useRef<() => void>(() => {});
  const isCellFreeForMeRef = useRef(isCellFreeForMe);
  const tryClaimCellRef = useRef(tryClaimCell);
  const releaseMyCellRef = useRef(releaseMyCell);
  const commutePurposeRef = useRef(commutePurpose);
  // A pause must not force all ~200 memoized sprite bodies through React.
  // The module-wide native lifecycle already subscribes to the game clock;
  // this committed-props ref keeps the one native activity listener current
  // without unsubscribe/subscribe churn on each route or fixed-cell change.
  const activityConfigRef = useRef({ fixedCell, commutePath, disableIdleRoam });
  React.useLayoutEffect(() => {
    activityConfigRef.current = { fixedCell, commutePath, disableIdleRoam };
  }, [fixedCell, commutePath, disableIdleRoam]);
  /** Fallimenti consecutivi di claim sul segmento corrente. */
  const [claimRetry] = useState(() => new NativeResidentCollisionRetry(MAX_CLAIM_FAILS_BEFORE_REPATH));
  const [routeEpoch] = useState(() => new NativeResidentRouteEpoch());
  onCommuteCompleteRef.current = onCommuteComplete;
  onCommuteBlockedRef.current = onCommuteBlocked;
  onCellSettledRef.current = onCellSettled;
  isCellFreeForMeRef.current = isCellFreeForMe;
  tryClaimCellRef.current = tryClaimCell;
  releaseMyCellRef.current = releaseMyCell;
  commutePurposeRef.current = commutePurpose;

  const handlePress = useCallback(() => {
    // Opt-in diagnostic measures JS execution of the Pressable handler,
    // NOT the delay between a physical touch and React Native delivery.
    const timing = beginNativeResidentDispatch("touch");
    try {
      if (!onPress && !onDoublePress) return;
      if (onDoublePress && tapRecognizer.press(performance.now()) === "double") {
        onDoublePress();
        return;
      }
      if (!onDoublePress) tapRecognizer.reset();
      if (onPress) {
        onPress();
      } else if (onDoublePress) {
        // Solo doppio tocco configurato: primo tap arma, secondo apre.
      }
    } finally {
      endNativeResidentDispatch("touch", timing);
    }
  }, [onPress, onDoublePress, tapRecognizer]);

  // cellRef is the authoritative current cell. React state is published only
  // when the hit target changes eligibility, not at every segment arrival.
  const passTouchesRef = useRef(passTouchesToMapOnCell);
  passTouchesRef.current = passTouchesToMapOnCell;
  const publishCell = useCallback((nextCell: number) => {
    const previousCell = cellRef.current;
    cellRef.current = nextCell;
    if (nativeResidentNeedsTouchRender(previousCell, nextCell, passTouchesRef.current)) {
      setLogicalCell(nextCell);
    }
  }, []);

  const clearIdle = useCallback(() => wakeTimer.cancel(), [wakeTimer]);

  // A reserved destination belongs to a moving segment, not to the logical
  // cell until arrival. On terminal interruption, atomically reclaim the
  // settled cell; if another resident took it, release our stale destination.
  // Seamless segment-to-segment transitions continue to use motion.cancel().
  const stopAndReconcile = useCallback(() => {
    const interrupted = isMovingRef.current;
    motion.stop();
    if (interrupted) {
      nativeResidentReconcileInterruptedClaim(
        cellRef.current, tryClaimCellRef.current, releaseMyCellRef.current
      );
    }
  }, [motion]);

  const pickNextMove = useCallback(() => {
    if (!isNativeResidentFrameBusActive() || getOrologioGiocoInPausaSnapshot()) return;
    if (disableIdleRoam) return;
    if (fixedCell != null) return;
    if (commutePath != null && commutePath.length >= 2) return;
    const prev = cellRef.current;
    if (prev === null) return;

    // Same left/right/up/down filter, Fisher-Yates shuffle and atomic claim
    // order as the previous implementation, but no transient neighbor arrays.
    const next = neighborSampler.pick(
      prev, cols, rows, isWalkable,
      isCellFreeForMeRef.current, tryClaimCellRef.current
    );
    if (next == null) {
      wakeTimer.schedule(() => {
        pickNextMoveRef.current();
      }, IDLE_BEFORE_NEXT_MS);
      return;
    }

    face(directionBetween(prev, next, cols));

    const fromX = (prev % cols) * cellSizePx;
    const fromY = Math.floor(prev / cols) * cellSizePx;
    const toX = (next % cols) * cellSizePx;
    const toY = Math.floor(next / cols) * cellSizePx;
    const dest = next;

    motion.start({
      from: { x: fromX, y: fromY },
      to: { x: toX, y: toY },
      startTimestamp: performance.now(),
      durationMs: segmentMoveDurationMs(prev, next, isRoadCell),
      onArrival: () => {
        publishCell(dest);
        onCellSettledRef.current?.(dest);
        wakeTimer.schedule(() => {
          pickNextMoveRef.current();
        }, IDLE_BEFORE_NEXT_MS);
      }
    });
  }, [cols, rows, cellSizePx, isWalkable, isRoadCell, fixedCell, commutePath, disableIdleRoam, face, motion, wakeTimer, neighborSampler, publishCell]);

  pickNextMoveRef.current = pickNextMove;

  const runOneSegment = useCallback(
    (from: number, to: number, onDone: () => void, isLastSegment: boolean, routeToken: number) => {
      if (!routeEpoch.isCurrent(routeToken)) return;
      // Do not claim a cell or start movement while the game is paused.
      // The useGiocoInPausa effect resumes this precise segment on unpause.
      if (!isNativeResidentFrameBusActive() || getOrologioGiocoInPausaSnapshot()) {
        pendingCommuteRetry.hold(() => runOneSegment(from, to, onDone, isLastSegment, routeToken));
        return;
      }
      pendingCommuteRetry.clear();
      const claim = tryClaimCellRef.current;
      const purpose = commutePurposeRef.current;
      /** Ultimo passo verso casa: più abitanti possono condividere l’ingresso. */
      const softHomeEntry = isLastSegment && purpose === "home";

      if (claim && !softHomeEntry && !claim(to)) {
        // A completed intermediate step may deliberately keep the walking
        // sprite active. A blocked next cell has no active segment: stop that
        // animation before scheduling a retry or notifying the parent.
        // The settled cell retains its existing claim; only the destination
        // failed, so do not release/reclaim occupancy here.
        motion.stop();
        const canRepath = purpose != null && onCommuteBlockedRef.current != null;
        const decision = claimRetry.fail(canRepath);
        if (decision === "request-repath") {
          // A previously canceled fallback may arrive after a newer route
          // starts waiting for repath. Capture this request generation so an
          // old closure cannot resume the new route or claim its cells.
          const repathGeneration = claimRetry.repathGeneration();
          // The parent can legitimately find no alternate path (e.g. a
          // blocked bar/market entrance). Do not strand this resident forever:
          // give the parent a chance to replace/complete the route, then
          // resume the original 900 ms collision retry if it did neither.
          // A route change clears both this timer and the held callback.
          pendingCommuteRetry.hold(() => {
            if (routeEpoch.isCurrent(routeToken) && claimRetry.resumeWithoutRepath(repathGeneration)) {
              runOneSegment(from, to, onDone, isLastSegment, routeToken);
            }
          });
          wakeTimer.schedule(() => {
            if (!routeEpoch.isCurrent(routeToken)) return;
            pendingCommuteRetry.take()?.();
          }, CLAIM_RETRY_MS);
          if (purpose != null) onCommuteBlockedRef.current?.({ fromCell: from, blockedCell: to, purpose });
          return;
        }
        if (decision === "awaiting-repath") return;
        pendingCommuteRetry.hold(() => runOneSegment(from, to, onDone, isLastSegment, routeToken));
        wakeTimer.schedule(() => {
          if (!routeEpoch.isCurrent(routeToken)) return;
          pendingCommuteRetry.take()?.();
        }, CLAIM_RETRY_MS);
        return;
      }

      // Soft entry casa: prova claim, ma prosegui anche se fallisce.
      if (claim && softHomeEntry) {
        claim(to);
      }

      claimRetry.reset();
      face(directionBetween(from, to, cols));
      const fromX = (from % cols) * cellSizePx;
      const fromY = Math.floor(from / cols) * cellSizePx;
      const toX = (to % cols) * cellSizePx;
      const toY = Math.floor(to / cols) * cellSizePx;
      motion.start({
        from: { x: fromX, y: fromY },
        to: { x: toX, y: toY },
        startTimestamp: performance.now(),
        durationMs: segmentMoveDurationMs(from, to, isRoadCell),
        keepWalkingOnArrival: !isLastSegment,
        onArrival: () => {
          if (!routeEpoch.isCurrent(routeToken)) return;
          // The final home doorway is shared. Even if its soft claim failed,
          // release the previously reserved street cell before notifying
          // the parent (which can synchronously replace the route).
          nativeResidentReleaseSharedHomeArrival(
            isLastSegment, purpose, releaseMyCellRef.current
          );
          publishCell(to);
          // The parent may synchronously replace this commute while handling
          // the arrival. Never continue a route that lost ownership there.
          if (!routeEpoch.runIfCurrent(routeToken, () => onCellSettledRef.current?.(to))) return;
          onDone();
        }
      });
    },
    [cols, cellSizePx, isRoadCell, pendingCommuteRetry, face, motion, claimRetry, routeEpoch, wakeTimer, publishCell]
  );

  /** Percorso casa → lavoro / lavoro → casa / … */
  useEffect(() => {
    if (routeMode !== "commute" || !commutePath || commutePath.length < 2) return;
    const routeToken = routeEpoch.begin();
    let alive = true;
    clearIdle();
    pendingCommuteRetry.clear();
    // A route reset is terminal. Roll back any unfinished destination claim
    // before snapping to the new path's origin.
    const previousCell = cellRef.current;
    stopAndReconcile();
    inited.current = true;
    claimRetry.reset();
    const path = commutePath;
    const start = path[0]!;
    // A parent-supplied reroute may begin at a different cell. Never retain
    // the previous reservation or force an exclusive claim at a shared home.
    nativeResidentReleaseMismatchedRouteOrigin(
      previousCell, start, releaseMyCellRef.current
    );
    const cx = (start % cols) * cellSizePx;
    const cy = Math.floor(start / cols) * cellSizePx;
    publishCell(start);
    pixelPos.setValue({ x: cx, y: cy });
    // Partenza spesso condivisa (casa): non claim esclusivo; claim al primo passo verso `to`.
    // The notification may invalidate the route, but this effect must still
    // return its cleanup. stepChain checks the route epoch before any work.
    onCellSettledRef.current?.(start);

    let seg = 0;
    let completionEmitted = false;
    const stepChain = () => {
      if (!alive || !routeEpoch.isCurrent(routeToken)) return;
      if (seg >= path.length - 1) {
        if (completionEmitted) return;
        completionEmitted = true;
        // Completion can synchronously replace or end this route. Notify
        // exactly once; do not schedule an idle timer while commute still
        // owns the resident. The commute -> free effect arms its own 2200 ms
        // idle delay if and when free roaming actually becomes eligible.
        if (commutePurpose != null) {
          routeEpoch.runIfCurrent(routeToken, () => onCommuteCompleteRef.current?.(commutePurpose));
        }
        return;
      }
      const from = path[seg]!;
      const to = path[seg + 1]!;
      const isLastSegment = seg + 1 >= path.length - 1;
      seg++;
      runOneSegment(from, to, stepChain, isLastSegment, routeToken);
    };
    stepChain();
    return () => {
      alive = false;
      routeEpoch.invalidate();
      pendingCommuteRetry.clear();
      // A canceled mid-segment destination must not remain reserved.
      // Reclaim the last settled cell or release if another owner took it.
      stopAndReconcile();
      clearIdle();
    };
  }, [
    commutePath,
    routeMode,
    commuteToken,
    commutePurpose,
    cols,
    cellSizePx,
    clearIdle,
    runOneSegment,
    pendingCommuteRetry,
    claimRetry,
    routeEpoch,
    spriteFrames,
    stopAndReconcile,
    publishCell
  ]);

  /** Di notte sulla residenza: fermo, sotto il layer edifici. */
  useEffect(() => {
    // Commute outranks the home anchor, including a simultaneous morning
    // transition. Otherwise this effect cancels the newly started segment.
    if (routeMode !== "fixed" || fixedCell == null) return;
    clearIdle();
    // Fixed/home transitions terminate movement, not merely its RAF.
    motion.stop();
    inited.current = true;
    // In casa più abitanti possono condividere la stessa cella: libera la casella strada.
    releaseMyCellRef.current?.();
    const cx = (fixedCell % cols) * cellSizePx;
    const cy = Math.floor(fixedCell / cols) * cellSizePx;
    publishCell(fixedCell);
    pixelPos.setValue({ x: cx, y: cy });
    isMovingRef.current = false;
    spriteFrames.setMoving(false);
    face("s");
    onCellSettledRef.current?.(fixedCell);
  }, [fixedCell, routeMode, cols, cellSizePx, clearIdle, face, spriteFrames, motion, publishCell]);

  /** Fine notte in casa → resta sulla stessa cella (casa), niente teletrasporto a caso sulla mappa. */
  useEffect(() => {
    // A commute invalidates a remembered night exit. Clearing its path later
    // must never snap an already-arrived resident back to the old home cell.
    const transition = nativeResidentHomeTransition(prevFixedCellRef.current, routeMode, fixedCell);
    prevFixedCellRef.current = transition.nextHome;
    const prevHome = transition.wakeCell;
    if (prevHome == null) return;

    clearIdle();
    motion.stop();
    // A shared home may already belong to another resident; on failed claim
    // release any old destination rather than leaving a ghost reservation.
    nativeResidentReconcileInterruptedClaim(
      prevHome, tryClaimCellRef.current, releaseMyCellRef.current
    );
    const cx = (prevHome % cols) * cellSizePx;
    const cy = Math.floor(prevHome / cols) * cellSizePx;
    inited.current = true;
    publishCell(prevHome);
    pixelPos.setValue({ x: cx, y: cy });
    isMovingRef.current = false;
    spriteFrames.setMoving(false);
    onCellSettledRef.current?.(prevHome);
    if (!disableIdleRoam) {
      wakeTimer.schedule(() => {
        pickNextMoveRef.current();
      }, IDLE_BEFORE_NEXT_MS);
    }
  }, [fixedCell, routeMode, clearIdle, cols, cellSizePx, disableIdleRoam, spriteFrames, motion, publishCell]);

  /** Disabling free roaming while an idle step is already underway must
   * stop that step and reconcile its reserved destination immediately.
   */
  useEffect(() => {
    if (routeMode !== "free" || !disableIdleRoam) return;
    clearIdle();
    stopAndReconcile();
  }, [routeMode, disableIdleRoam, clearIdle, stopAndReconcile]);

  /** Removing a completed commute cancels its old idle timeout in cleanup.
   * Restore one idle countdown without waiting for an unrelated clock render.
   * Never claim or animate during pause/background, or while still moving.
   */
  useEffect(() => {
    const previous = previousIdleContextRef.current;
    previousIdleContextRef.current = { routeMode, disableIdleRoam };
    if (!nativeResidentShouldRearmIdle(
      previous.routeMode, routeMode, previous.disableIdleRoam, disableIdleRoam
    )) return;
    if (!isNativeResidentFrameBusActive() || getOrologioGiocoInPausaSnapshot()) return;
    if (cellRef.current == null || !inited.current) return;
    if (wakeTimer.pending || isMovingRef.current) return;
    wakeTimer.schedule(() => {
      pickNextMoveRef.current();
    }, IDLE_BEFORE_NEXT_MS);
  }, [routeMode, disableIdleRoam]);

  useEffect(() => {
    if (commutePath != null && commutePath.length >= 2) return;
    if (fixedCell != null) return;
    if (inited.current) return;
    // One shared native scratch buffer across all cold-mounted residents.
    // Keep preferred shared-home and occupancy behavior byte-for-byte equivalent.
    const idx = nativeResidentSpawnSampler.pick({
      totalCells: cols * rows,
      instanceId,
      preferredSpawnCell,
      isWalkable,
      isCellFreeForMe: isCellFreeForMeRef.current,
      tryClaimCell: tryClaimCellRef.current
    });
    if (idx == null) return;

    inited.current = true;
    const cx = (idx % cols) * cellSizePx;
    const cy = Math.floor(idx / cols) * cellSizePx;
    publishCell(idx);
    pixelPos.setValue({ x: cx, y: cy });
    onCellSettledRef.current?.(idx);
    if (!disableIdleRoam) {
      wakeTimer.schedule(() => {
        pickNextMoveRef.current();
      }, IDLE_BEFORE_NEXT_MS);
    }
  }, [
    cols,
    rows,
    isWalkable,
    instanceId,
    fixedCell,
    preferredSpawnCell,
    commutePath,
    disableIdleRoam,
    cellSizePx,
    spriteFrames,
    publishCell
  ]);

  /**
   * The shared timer queue freezes deadlines on pause/background. Keep each
   * resident's pending timer rather than deleting and restarting it; only
   * rearm if no timeout was pending when the game became active.
   */
  const onResidentActivityChanged = useCallback((active: boolean) => {
    // A tap while the game is paused must not pair with a tap after resume,
    // just as a tap before background must not pair with one after foreground.
    // Transitions are rare; this adds no per-frame or per-tap subscription.
    tapRecognizer.reset();
    if (!active) return;
    const { fixedCell, commutePath, disableIdleRoam } = activityConfigRef.current;
    if (commutePath != null && commutePath.length >= 2) {
      // A collision retry already scheduled before pause resumes with its
      // remaining delay. Untimed retries held when starting paused run now.
      if (!wakeTimer.pending) pendingCommuteRetry.take()?.();
      return;
    }
    if (fixedCell != null || disableIdleRoam) return;
    if (cellRef.current == null || !inited.current || isMovingRef.current) return;
    if (wakeTimer.pending) return;
    wakeTimer.schedule(() => {
      pickNextMoveRef.current();
    }, IDLE_BEFORE_NEXT_MS);
  }, [pendingCommuteRetry, tapRecognizer, wakeTimer]);

  // One stable listener per mounted resident. Pauses and foreground changes
  // are delivered synchronously by the shared bus, not React render effects.
  useEffect(() => {
    return subscribeNativeResidentFrameBusActivity(onResidentActivityChanged);
  }, [onResidentActivityChanged]);

  useEffect(
    () => () => {
      clearIdle();
      pendingCommuteRetry.clear();
      motion.cancel();
      tapRecognizer.reset();
      releaseMyCellRef.current?.();
    },
    [clearIdle, pendingCommuteRetry, motion, tapRecognizer]
  );

  // The rendered cell can lag behind actual movement when the touch policy
  // stays unchanged. A parent-prop render must evaluate the LIVE cell.
  const passTouchesToGrid = logicalCell !== null &&
    passTouchesToMapOnCell != null &&
    passTouchesToMapOnCell(cellRef.current ?? logicalCell) === true;
  const intercettaTocco = logicalCell !== null && (!!onPress || !!onDoublePress) && !passTouchesToGrid;
  // Clear an unfinished pair whenever the committed resident hit target is
  // removed or its double-tap handler becomes available/unavailable. This
  // also covers home/footprint pass-through changes without extra timers.
  React.useLayoutEffect(() => {
    tapRecognizer.setEligibleForDoubleTap(intercettaTocco && !!onDoublePress);
  }, [tapRecognizer, intercettaTocco, onDoublePress]);

  if (logicalCell === null) return null;

  const shellStyle = [
    styles.anchor,
    {
      ...pixelPos.getLayout(),
      width: cellSizePx,
      height: cellSizePx,
      overflow: "visible" as const,
      zIndex: fixedCell != null ? 1 : 10 + instanceId
    }
  ];

  const usaEmojiMarker = markerEmoji != null && markerEmoji !== "";

  const frameW = cellSizePx;
  const frameH = cellSizePx * 1.22;
  const sheetW = FRAMES * frameW;
  const sheetH = frameH;

  const sprite = usaEmojiMarker ? (
    <View style={[styles.spriteColumn, { height: cellSizePx, width: cellSizePx }]}>
      <Text style={[styles.markerEmoji, { fontSize: cellSizePx * 0.72 }]}>{markerEmoji}</Text>
    </View>
  ) : (
    <View style={[styles.spriteColumn, { height: cellSizePx, width: cellSizePx }]}>
      <Animated.View
        style={[
          styles.clip,
          {
            width: frameW,
            height: frameH,
            transform: [{ scaleX: spriteMirrorScaleX }]
          }
        ]}
      >
        <Animated.Image
          source={CHARACTER_SHEET}
          resizeMode="stretch"
          style={{
            position: "absolute",
            width: sheetW,
            height: sheetH,
            left: spriteSheetOffset,
            top: 0
          }}
        />
      </Animated.View>
    </View>
  );

  if (intercettaTocco) {
    return (
      <AnimatedPressable
        style={shellStyle}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={
          pressAccessibilityLabel ??
          doubleTapAccessibilityLabel ??
          "Seleziona abitante"
        }
      >
        {sprite}
      </AnimatedPressable>
    );
  }

  return (
    <Animated.View style={shellStyle} pointerEvents="none">
      {sprite}
    </Animated.View>
  );
}


/**
 * The parent map changes inline handlers at every world-clock render. Keep
 * the simulation/sprite subtree memoized while the outer wrapper refreshes
 * the live event targets after commit. Non-event props, including walkable
 * predicates, road predicates, path, night cell, accessibility and hit-test
 * passthrough, retain normal shallow comparison and trigger a real render.
 */
const MemoNativeResidentBody = React.memo(NativeResidentBody);

export function MapWandererCharacter(props: MapWandererCharacterProps) {
  if (__DEV__) markNativeResidentWrapperInvocation();
  const relay = useRef<NativeResidentCallbackRelay | null>(null);
  if (relay.current === null) relay.current = new NativeResidentCallbackRelay(props);
  // Commit-phase update avoids exposing callbacks from an aborted React render.
  React.useLayoutEffect(() => { relay.current?.update(props); });
  // Optional handler presence must reflect this render, not the previous one.
  return <MemoNativeResidentBody {...props} {...relay.current.bound(props)} />;
}

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    zIndex: 10
  },
  spriteColumn: {
    alignItems: "center",
    justifyContent: "flex-end"
  },
  clip: {
    overflow: "hidden"
  },
  markerEmoji: {
    textAlign: "center",
    lineHeight: undefined
  }
});
