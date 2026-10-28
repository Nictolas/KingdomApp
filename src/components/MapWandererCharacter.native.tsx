import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { getOrologioGiocoInPausaSnapshot, getOrologioSimTimeScaleSnapshot } from "../game/orologioGiocoSession";
import { NativeResidentSegmentRunner } from "../performance/nativeResidentSegmentRunner";
import { beginNativeResidentDispatch, endNativeResidentDispatch } from "../performance/nativeResidentDispatchProfiler";
import { PendingCommuteRetry } from "../game/pendingCommuteRetry";
import { markNativeResidentFrameCallback, markNativeResidentRenderInvocation, markNativeResidentWrapperInvocation } from "../performance/nativeResidentWorkCounters";
import { NativeResidentCallbackRelay } from "../performance/nativeResidentCallbackRelay";
import { NativeResidentSpriteFrameDriver } from "../performance/nativeResidentSpriteFrameDriver";
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

const DOPPIO_TAP_MS = 400;

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

function orthogonalNeighbors(index: number, cols: number, rows: number): number[] {
  const c = index % cols;
  const r = Math.floor(index / cols);
  const out: number[] = [];
  if (c > 0) out.push(index - 1);
  if (c < cols - 1) out.push(index + 1);
  if (r > 0) out.push(index - cols);
  if (r < rows - 1) out.push(index + cols);
  return out;
}

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
  const [spriteFrames] = useState(() =>
    new NativeResidentSpriteFrameDriver(cellSizePx, (left) => spriteSheetOffset.setValue(left))
  );
  const [direction, setDirection] = useState<WanderDirection>("s");
  const face = useCallback((next: WanderDirection) => {
    spriteFrames.face(next);
    setDirection(next); // Only direction changes need a render (west mirror).
  }, [spriteFrames]);
  React.useLayoutEffect(() => {
    spriteFrames.setCellSize(cellSizePx);
  }, [spriteFrames, cellSizePx]);

  const inited = useRef(false);
  const isMovingRef = useRef(false);
  const prevFixedCellRef = useRef<number | null | undefined>(undefined);
  const idleTimerRef = useRef<number | null>(null);
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
    onFrame: () => { if (__DEV__) markNativeResidentFrameCallback(); }
  }));
  const lastTapTimeRef = useRef(0);
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
  const claimFailCountRef = useRef(0);
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
      const now = Date.now();
      if (onDoublePress && lastTapTimeRef.current > 0 && now - lastTapTimeRef.current < DOPPIO_TAP_MS) {
        lastTapTimeRef.current = 0;
        onDoublePress();
        return;
      }
      lastTapTimeRef.current = now;
      if (onPress) {
        onPress();
      } else if (onDoublePress) {
        // Solo doppio tocco configurato: primo tap arma, secondo apre.
      }
    } finally {
      endNativeResidentDispatch("touch", timing);
    }
  }, [onPress, onDoublePress]);

  useEffect(() => {
    cellRef.current = logicalCell;
  }, [logicalCell]);

  const clearIdle = useCallback(() => {
    if (idleTimerRef.current != null) {
      cancelNativeResidentTimer(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const pickNextMove = useCallback(() => {
    if (!isNativeResidentFrameBusActive() || getOrologioGiocoInPausaSnapshot()) return;
    if (disableIdleRoam) return;
    if (fixedCell != null) return;
    if (commutePath != null && commutePath.length >= 2) return;
    const prev = cellRef.current;
    if (prev === null) return;

    const isFree = isCellFreeForMeRef.current;
    const cand = orthogonalNeighbors(prev, cols, rows).filter(
      (j) => isWalkable(j) && (isFree?.(j) ?? true)
    );
    if (cand.length === 0) {
      idleTimerRef.current = scheduleNativeResidentTimer(() => {
        idleTimerRef.current = null;
        pickNextMoveRef.current();
      }, IDLE_BEFORE_NEXT_MS);
      return;
    }

    // Prova le celle candidate in ordine casuale finché una non viene prenotata.
    for (let i = cand.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = cand[i]!;
      cand[i] = cand[j]!;
      cand[j] = tmp;
    }

    let next: number | null = null;
    const claim = tryClaimCellRef.current;
    for (const c of cand) {
      if (!claim || claim(c)) {
        next = c;
        break;
      }
    }
    if (next == null) {
      idleTimerRef.current = scheduleNativeResidentTimer(() => {
        idleTimerRef.current = null;
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
        setLogicalCell(dest);
        cellRef.current = dest;
        onCellSettledRef.current?.(dest);
        idleTimerRef.current = scheduleNativeResidentTimer(() => {
          idleTimerRef.current = null;
          pickNextMoveRef.current();
        }, IDLE_BEFORE_NEXT_MS);
      }
    });
  }, [cols, rows, cellSizePx, isWalkable, isRoadCell, fixedCell, commutePath, disableIdleRoam, face, motion]);

  pickNextMoveRef.current = pickNextMove;

  const runOneSegment = useCallback(
    (from: number, to: number, onDone: () => void, isLastSegment: boolean) => {
      // Do not claim a cell or start movement while the game is paused.
      // The useGiocoInPausa effect resumes this precise segment on unpause.
      if (!isNativeResidentFrameBusActive() || getOrologioGiocoInPausaSnapshot()) {
        pendingCommuteRetry.hold(() => runOneSegment(from, to, onDone, isLastSegment));
        return;
      }
      pendingCommuteRetry.clear();
      const claim = tryClaimCellRef.current;
      const purpose = commutePurposeRef.current;
      /** Ultimo passo verso casa: più abitanti possono condividere l’ingresso. */
      const softHomeEntry = isLastSegment && purpose === "home";

      if (claim && !softHomeEntry && !claim(to)) {
        claimFailCountRef.current += 1;
        if (
          claimFailCountRef.current >= MAX_CLAIM_FAILS_BEFORE_REPATH &&
          purpose != null &&
          onCommuteBlockedRef.current
        ) {
          claimFailCountRef.current = 0;
          onCommuteBlockedRef.current({ fromCell: from, blockedCell: to, purpose });
          return;
        }
        pendingCommuteRetry.hold(() => runOneSegment(from, to, onDone, isLastSegment));
        idleTimerRef.current = scheduleNativeResidentTimer(() => {
          idleTimerRef.current = null;
          pendingCommuteRetry.take()?.();
        }, CLAIM_RETRY_MS);
        return;
      }

      // Soft entry casa: prova claim, ma prosegui anche se fallisce.
      if (claim && softHomeEntry) {
        claim(to);
      }

      claimFailCountRef.current = 0;
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
          setLogicalCell(to);
          cellRef.current = to;
          onCellSettledRef.current?.(to);
          onDone();
        }
      });
    },
    [cols, cellSizePx, isRoadCell, pendingCommuteRetry, face, motion]
  );

  /** Percorso casa → lavoro / lavoro → casa / … */
  useEffect(() => {
    if (!commutePath || commutePath.length < 2) return;
    let alive = true;
    clearIdle();
    pendingCommuteRetry.clear();
    motion.cancel();
    inited.current = true;
    claimFailCountRef.current = 0;
    const path = commutePath;
    const start = path[0]!;
    const cx = (start % cols) * cellSizePx;
    const cy = Math.floor(start / cols) * cellSizePx;
    setLogicalCell(start);
    cellRef.current = start;
    pixelPos.setValue({ x: cx, y: cy });
    isMovingRef.current = false;
    spriteFrames.setMoving(false);
    // Partenza spesso condivisa (casa): non claim esclusivo; claim al primo passo verso `to`.
    onCellSettledRef.current?.(start);

    let seg = 0;
    const stepChain = () => {
      if (!alive) return;
      if (seg >= path.length - 1) {
        if (commutePurpose != null) onCommuteCompleteRef.current?.(commutePurpose);
        idleTimerRef.current = scheduleNativeResidentTimer(() => {
        idleTimerRef.current = null;
        pickNextMoveRef.current();
      }, IDLE_BEFORE_NEXT_MS);
        return;
      }
      const from = path[seg]!;
      const to = path[seg + 1]!;
      const isLastSegment = seg + 1 >= path.length - 1;
      seg++;
      runOneSegment(from, to, stepChain, isLastSegment);
    };
    stepChain();
    return () => {
      alive = false;
      pendingCommuteRetry.clear();
      motion.cancel();
      clearIdle();
    };
  }, [
    commutePath,
    commuteToken,
    commutePurpose,
    cols,
    cellSizePx,
    clearIdle,
    runOneSegment,
    pendingCommuteRetry,
    spriteFrames,
    motion
  ]);

  /** Di notte sulla residenza: fermo, sotto il layer edifici. */
  useEffect(() => {
    if (fixedCell == null) return;
    clearIdle();
    motion.cancel();
    inited.current = true;
    // In casa più abitanti possono condividere la stessa cella: libera la casella strada.
    releaseMyCellRef.current?.();
    const cx = (fixedCell % cols) * cellSizePx;
    const cy = Math.floor(fixedCell / cols) * cellSizePx;
    setLogicalCell(fixedCell);
    cellRef.current = fixedCell;
    pixelPos.setValue({ x: cx, y: cy });
    isMovingRef.current = false;
    spriteFrames.setMoving(false);
    face("s");
    onCellSettledRef.current?.(fixedCell);
  }, [fixedCell, cols, cellSizePx, clearIdle, face, spriteFrames, motion]);

  /** Fine notte in casa → resta sulla stessa cella (casa), niente teletrasporto a caso sulla mappa. */
  useEffect(() => {
    if (fixedCell != null) {
      prevFixedCellRef.current = fixedCell;
      return;
    }
    const prevHome = prevFixedCellRef.current;
    prevFixedCellRef.current = fixedCell;
    if (prevHome == null) return;

    clearIdle();
    motion.cancel();
    const claim = tryClaimCellRef.current;
    claim?.(prevHome);
    const cx = (prevHome % cols) * cellSizePx;
    const cy = Math.floor(prevHome / cols) * cellSizePx;
    inited.current = true;
    setLogicalCell(prevHome);
    cellRef.current = prevHome;
    pixelPos.setValue({ x: cx, y: cy });
    isMovingRef.current = false;
    spriteFrames.setMoving(false);
    onCellSettledRef.current?.(prevHome);
    if (!disableIdleRoam) {
      idleTimerRef.current = scheduleNativeResidentTimer(() => {
        idleTimerRef.current = null;
        pickNextMoveRef.current();
      }, IDLE_BEFORE_NEXT_MS);
    }
  }, [fixedCell, clearIdle, cols, cellSizePx, disableIdleRoam, spriteFrames, motion]);

  useEffect(() => {
    if (commutePath != null && commutePath.length >= 2) return;
    if (fixedCell != null) return;
    if (inited.current) return;
    const tot = cols * rows;
    const isFree = isCellFreeForMeRef.current;
    const claim = tryClaimCellRef.current;

    const provaCella = (c: number): boolean => {
      if (c < 0 || c >= tot) return false;
      if (!isWalkable(c)) return false;
      if (!(isFree?.(c) ?? true)) return false;
      return !claim || claim(c);
    };

    let idx: number | null = null;
    if (preferredSpawnCell != null && provaCella(preferredSpawnCell)) {
      idx = preferredSpawnCell;
    } else if (preferredSpawnCell != null && isWalkable(preferredSpawnCell)) {
      // Preferita occupata: claim forzato se walkable (casa condivisa / uscita lavoro).
      claim?.(preferredSpawnCell);
      idx = preferredSpawnCell;
    }

    if (idx == null) {
      const ok: number[] = [];
      for (let i = 0; i < tot; i++) {
        if (isWalkable(i) && (isFree?.(i) ?? true)) ok.push(i);
      }
      if (ok.length === 0) {
        for (let i = 0; i < tot; i++) {
          if (isWalkable(i)) ok.push(i);
        }
      }
      if (ok.length === 0) return;
      const preferred = (instanceId * 9973) % ok.length;
      for (let offset = 0; offset < ok.length; offset++) {
        const candidate = ok[(preferred + offset) % ok.length]!;
        if (!claim || claim(candidate)) {
          idx = candidate;
          break;
        }
      }
    }
    if (idx == null) return;

    inited.current = true;
    const cx = (idx % cols) * cellSizePx;
    const cy = Math.floor(idx / cols) * cellSizePx;
    setLogicalCell(idx);
    cellRef.current = idx;
    pixelPos.setValue({ x: cx, y: cy });
    onCellSettledRef.current?.(idx);
    if (!disableIdleRoam) {
      idleTimerRef.current = scheduleNativeResidentTimer(() => {
        idleTimerRef.current = null;
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
    spriteFrames
  ]);

  /**
   * The shared timer queue freezes deadlines on pause/background. Keep each
   * resident's pending timer rather than deleting and restarting it; only
   * rearm if no timeout was pending when the game became active.
   */
  const onResidentActivityChanged = useCallback((active: boolean) => {
    if (!active) return;
    const { fixedCell, commutePath, disableIdleRoam } = activityConfigRef.current;
    if (commutePath != null && commutePath.length >= 2) {
      // A collision retry already scheduled before pause resumes with its
      // remaining delay. Untimed retries held when starting paused run now.
      if (idleTimerRef.current == null) pendingCommuteRetry.take()?.();
      return;
    }
    if (fixedCell != null || disableIdleRoam) return;
    if (cellRef.current == null || !inited.current || isMovingRef.current) return;
    if (idleTimerRef.current != null) return;
    idleTimerRef.current = scheduleNativeResidentTimer(() => {
      idleTimerRef.current = null;
      pickNextMoveRef.current();
    }, IDLE_BEFORE_NEXT_MS);
  }, [pendingCommuteRetry]);

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
      releaseMyCellRef.current?.();
    },
    [clearIdle, pendingCommuteRetry, motion]
  );

  if (logicalCell === null) return null;

  const passTouchesToGrid =
    passTouchesToMapOnCell != null && passTouchesToMapOnCell(logicalCell) === true;
  const intercettaTocco = (!!onPress || !!onDoublePress) && !passTouchesToGrid;

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

  const flipW = direction === "w";
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
      <View
        style={[
          styles.clip,
          {
            width: frameW,
            height: frameH,
            transform: flipW ? [{ scaleX: -1 }] : undefined
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
      </View>
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
