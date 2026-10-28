import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { getOrologioGiocoInPausaSnapshot, getOrologioSimTimeScaleSnapshot } from "../game/orologioGiocoSession";
import { PauseAwareMotionClock } from "../game/pauseAwareMotionClock";
import { PendingCommuteRetry } from "../game/pendingCommuteRetry";
import { markNativeResidentFrameCallback, markNativeResidentRenderInvocation } from "../performance/nativeResidentWorkCounters";
import { requestResidentAnimationFrame, cancelResidentAnimationFrame } from "../performance/nativeResidentFrameBus";
import { useGiocoInPausa } from "../hooks/useGiocoInPausa";
import {
  frameGroupStart,
  segmentMoveDurationMs,
  walkFrameFromElapsedMs,
  walkIndexInGroup,
  type WanderDirection
} from "../game/mapWandererMotion";

/**
 * Keep the native hit target animated together with the sprite. Unlike React
 * state-based coordinates, Animated.ValueXY.setValue updates positions without
 * reconciling the entire character component on every animation frame.
 * We deliberately retain the existing JS RAF clock and gameplay callbacks.
 */
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
export function MapWandererCharacter({
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
  const [direction, setDirection] = useState<WanderDirection>("s");
  const [walkFrame, setWalkFrame] = useState(0);
  const walkFrameRef = useRef(0);
  // React only needs a new sprite frame every ~180ms, not at every RAF tick.
  const updateWalkFrame = useCallback((next: number) => {
    if (walkFrameRef.current === next) return;
    walkFrameRef.current = next;
    setWalkFrame(next);
  }, []);
  const [isMoving, setIsMoving] = useState(false);
  const giocoInPausa = useGiocoInPausa();

  const inited = useRef(false);
  const isMovingRef = useRef(false);
  const prevGiocoInPausaRef = useRef(giocoInPausa);
  const prevFixedCellRef = useRef<number | null | undefined>(undefined);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Collision retry can be suspended across pauses without repeated timers. */
  const [pendingCommuteRetry] = useState(() => new PendingCommuteRetry());
  const rafRef = useRef<number | null>(null);
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
  }, [onPress, onDoublePress]);

  useEffect(() => {
    cellRef.current = logicalCell;
  }, [logicalCell]);

  useEffect(() => {
    isMovingRef.current = isMoving;
  }, [isMoving]);

  const clearIdle = useCallback(() => {
    if (idleTimerRef.current != null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const pickNextMove = useCallback(() => {
    if (getOrologioGiocoInPausaSnapshot()) return;
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
      idleTimerRef.current = setTimeout(() => pickNextMoveRef.current(), IDLE_BEFORE_NEXT_MS);
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
      idleTimerRef.current = setTimeout(() => pickNextMoveRef.current(), IDLE_BEFORE_NEXT_MS);
      return;
    }

    setDirection(directionBetween(prev, next, cols));

    if (rafRef.current != null) {
      cancelResidentAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const fromX = (prev % cols) * cellSizePx;
    const fromY = Math.floor(prev / cols) * cellSizePx;
    const toX = (next % cols) * cellSizePx;
    const toY = Math.floor(next / cols) * cellSizePx;

    setIsMoving(true);
    const clock = new PauseAwareMotionClock(performance.now());
    const durationMs = segmentMoveDurationMs(prev, next, isRoadCell);
    const dest = next;

    const step = (now: number) => {
      if (__DEV__) markNativeResidentFrameCallback();
      const timeScale = getOrologioSimTimeScaleSnapshot();
      const elapsedMs = clock.advanceScaled(now, timeScale);
      if (timeScale === 0) {
        rafRef.current = requestResidentAnimationFrame(step);
        return;
      }
      const t = Math.min(1, elapsedMs / durationMs);
      pixelPos.setValue({
        x: fromX + (toX - fromX) * t,
        y: fromY + (toY - fromY) * t
      });
      if (t < 1) {
        updateWalkFrame(walkFrameFromElapsedMs(elapsedMs));
        rafRef.current = requestResidentAnimationFrame(step);
      } else {
        pixelPos.setValue({ x: toX, y: toY });
        updateWalkFrame(0);
        setIsMoving(false);
        setLogicalCell(dest);
        cellRef.current = dest;
        onCellSettledRef.current?.(dest);
        idleTimerRef.current = setTimeout(() => pickNextMoveRef.current(), IDLE_BEFORE_NEXT_MS);
      }
    };
    rafRef.current = requestResidentAnimationFrame(step);
  }, [cols, rows, cellSizePx, isWalkable, isRoadCell, fixedCell, commutePath, disableIdleRoam]);

  pickNextMoveRef.current = pickNextMove;

  const runOneSegment = useCallback(
    (from: number, to: number, onDone: () => void, isLastSegment: boolean) => {
      // Do not claim a cell or start movement while the game is paused.
      // The useGiocoInPausa effect resumes this precise segment on unpause.
      if (getOrologioGiocoInPausaSnapshot()) {
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
        idleTimerRef.current = setTimeout(() => {
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
      setDirection(directionBetween(from, to, cols));
      if (rafRef.current != null) {
        cancelResidentAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const fromX = (from % cols) * cellSizePx;
      const fromY = Math.floor(from / cols) * cellSizePx;
      const toX = (to % cols) * cellSizePx;
      const toY = Math.floor(to / cols) * cellSizePx;
      setIsMoving(true);
      const clock = new PauseAwareMotionClock(performance.now());
      const durationMs = segmentMoveDurationMs(from, to, isRoadCell);
      const step = (now: number) => {
        if (__DEV__) markNativeResidentFrameCallback();
        const timeScale = getOrologioSimTimeScaleSnapshot();
        const elapsedMs = clock.advanceScaled(now, timeScale);
        if (timeScale === 0) {
          rafRef.current = requestResidentAnimationFrame(step);
          return;
        }
        const t = Math.min(1, elapsedMs / durationMs);
        pixelPos.setValue({
          x: fromX + (toX - fromX) * t,
          y: fromY + (toY - fromY) * t
        });
        if (t < 1) {
          updateWalkFrame(walkFrameFromElapsedMs(elapsedMs));
          rafRef.current = requestResidentAnimationFrame(step);
        } else {
          pixelPos.setValue({ x: toX, y: toY });
          updateWalkFrame(0);
          if (isLastSegment) {
            setIsMoving(false);
          }
          setLogicalCell(to);
          cellRef.current = to;
          onCellSettledRef.current?.(to);
          onDone();
        }
      };
      rafRef.current = requestResidentAnimationFrame(step);
    },
    [cols, cellSizePx, isRoadCell, pendingCommuteRetry]
  );

  /** Percorso casa → lavoro / lavoro → casa / … */
  useEffect(() => {
    if (!commutePath || commutePath.length < 2) return;
    let alive = true;
    clearIdle();
    pendingCommuteRetry.clear();
    if (rafRef.current != null) {
      cancelResidentAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    inited.current = true;
    claimFailCountRef.current = 0;
    const path = commutePath;
    const start = path[0]!;
    const cx = (start % cols) * cellSizePx;
    const cy = Math.floor(start / cols) * cellSizePx;
    setLogicalCell(start);
    cellRef.current = start;
    pixelPos.setValue({ x: cx, y: cy });
    setIsMoving(false);
    updateWalkFrame(0);
    // Partenza spesso condivisa (casa): non claim esclusivo; claim al primo passo verso `to`.
    onCellSettledRef.current?.(start);

    let seg = 0;
    const stepChain = () => {
      if (!alive) return;
      if (seg >= path.length - 1) {
        if (commutePurpose != null) onCommuteCompleteRef.current?.(commutePurpose);
        idleTimerRef.current = setTimeout(() => pickNextMoveRef.current(), IDLE_BEFORE_NEXT_MS);
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
      if (rafRef.current != null) {
        cancelResidentAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
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
    pendingCommuteRetry
  ]);

  /** Di notte sulla residenza: fermo, sotto il layer edifici. */
  useEffect(() => {
    if (fixedCell == null) return;
    clearIdle();
    if (rafRef.current != null) {
      cancelResidentAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    inited.current = true;
    // In casa più abitanti possono condividere la stessa cella: libera la casella strada.
    releaseMyCellRef.current?.();
    const cx = (fixedCell % cols) * cellSizePx;
    const cy = Math.floor(fixedCell / cols) * cellSizePx;
    setLogicalCell(fixedCell);
    cellRef.current = fixedCell;
    pixelPos.setValue({ x: cx, y: cy });
    setIsMoving(false);
    updateWalkFrame(0);
    setDirection("s");
    onCellSettledRef.current?.(fixedCell);
  }, [fixedCell, cols, cellSizePx, clearIdle]);

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
    if (rafRef.current != null) {
      cancelResidentAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const claim = tryClaimCellRef.current;
    claim?.(prevHome);
    const cx = (prevHome % cols) * cellSizePx;
    const cy = Math.floor(prevHome / cols) * cellSizePx;
    inited.current = true;
    setLogicalCell(prevHome);
    cellRef.current = prevHome;
    pixelPos.setValue({ x: cx, y: cy });
    setIsMoving(false);
    updateWalkFrame(0);
    onCellSettledRef.current?.(prevHome);
    if (!disableIdleRoam) {
      idleTimerRef.current = setTimeout(() => pickNextMoveRef.current(), IDLE_BEFORE_NEXT_MS);
    }
  }, [fixedCell, clearIdle, cols, cellSizePx, disableIdleRoam]);

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
      idleTimerRef.current = setTimeout(() => pickNextMoveRef.current(), IDLE_BEFORE_NEXT_MS);
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
    cellSizePx
  ]);

  /** Pausa globale: ferma timer idle; al ripristino riprende girovago se fermo. */
  useEffect(() => {
    if (prevGiocoInPausaRef.current === giocoInPausa) return;
    prevGiocoInPausaRef.current = giocoInPausa;
    if (giocoInPausa) {
      clearIdle();
      return;
    }
    if (commutePath != null && commutePath.length >= 2) {
      // An outstanding claim retry was canceled by clearIdle() at pause;
      // resume it once, rather than restarting the entire commute path.
      pendingCommuteRetry.take()?.();
      return;
    }
    if (fixedCell != null) return;
    if (disableIdleRoam) return;
    if (cellRef.current == null || !inited.current) return;
    if (isMovingRef.current) return;
    clearIdle();
    idleTimerRef.current = setTimeout(() => pickNextMoveRef.current(), IDLE_BEFORE_NEXT_MS);
  }, [giocoInPausa, fixedCell, commutePath, disableIdleRoam, clearIdle, pendingCommuteRetry]);

  useEffect(
    () => () => {
      clearIdle();
      pendingCommuteRetry.clear();
      if (rafRef.current != null) cancelResidentAnimationFrame(rafRef.current);
      releaseMyCellRef.current?.();
    },
    [clearIdle, pendingCommuteRetry]
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

  const group = frameGroupStart(direction);
  const frameInGroup = walkIndexInGroup(direction, walkFrame, isMoving);
  const frameIndex = Math.min(group + frameInGroup, FRAMES - 1);
  const flipW = direction === "w";
  const frameW = cellSizePx;
  const frameH = cellSizePx * 1.22;
  const sheetW = FRAMES * frameW;
  const sheetH = frameH;
  const offsetX = -frameIndex * frameW;

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
        <Image
          source={CHARACTER_SHEET}
          resizeMode="stretch"
          style={{
            position: "absolute",
            width: sheetW,
            height: sheetH,
            left: offsetX,
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
