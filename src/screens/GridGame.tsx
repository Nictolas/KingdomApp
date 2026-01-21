import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import type { Point, Placed, Bridge, Light, Building, Character } from "../types";
import {
  GRID_SIZE,
  NUM_CHARACTERS,
  CELL_SIZE,
  CELL_GAP,
  SEA_ROWS,
  BEACH_ROWS,
  LAND_ROWS,
  RIVER_XS,
  professions,
  firstNames,
  lastNames,
  castleData,
  farmData,
  houseData
} from "../constants";
import { clamp, isInsideBuilding, buildingCenter } from "../utils";

export default function GridGame() {
  // Stato mondo
  const [bridges, setBridges] = useState<Bridge[]>([]);
  const [trees, setTrees] = useState<Placed[]>([]);
  const [mines, setMines] = useState<Placed[]>([]);
  const [lights, setLights] = useState<Light[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  
  // Modalità costruzione
  const [buildMode, setBuildMode] = useState<"light" | null>(null);

  // Selezioni
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [selectedRiver, setSelectedRiver] = useState<Point | null>(null);

  // Camera
  const [viewOffset, setViewOffset] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<Point>({ x: 0, y: 0 });
  const lastTouchDistance = useRef<number | null>(null);
  const dragInfoRef = useRef<{ startX: number; startY: number; didDrag: boolean }>({ startX: 0, startY: 0, didDrag: false });
  const lastDragAtRef = useRef<number>(0);

  // Azioni “story”
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

  // Case: assegnazione abitanti
  const [houseAssignments, setHouseAssignments] = useState<Record<string, number | null>>({
    "house-1": null,
    "house-2": null,
    "house-3": null,
    "house-4": null
  });

  const gridPixelSize = useMemo(() => {
    const size = GRID_SIZE * (CELL_SIZE + CELL_GAP);
    return { w: size, h: size };
  }, []);

  // Terreni
  const isRiver = (x: number, y: number) => RIVER_XS.includes(x) && y >= 0 && y < LAND_ROWS;
  const isSea = (_x: number, y: number) => y >= GRID_SIZE - SEA_ROWS;
  const isBeach = (_x: number, y: number) => y >= GRID_SIZE - SEA_ROWS - BEACH_ROWS && y < GRID_SIZE - SEA_ROWS;

  const isBridge = (x: number, y: number) => bridges.some((b) => b.x === x && b.y === y);
  const isTree = (x: number, y: number) => trees.some((t) => t.x === x && t.y === y);
  const isMine = (x: number, y: number) => mines.some((m) => m.x === x && m.y === y);
  const isLight = (x: number, y: number) => lights.some((l) => l.x === x && l.y === y);
  
  // Calcola se una casella è illuminata (3x3 intorno a una luce)
  const isIlluminated = (x: number, y: number) => {
    for (const light of lights) {
      const dx = Math.abs(x - light.x);
      const dy = Math.abs(y - light.y);
      if (dx <= 1 && dy <= 1) return true;
    }
    return false;
  };

  const formatGameTime = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const isNight = useMemo(() => {
    const t = gameTime.hours * 60 + gameTime.minutes;
    return t >= 18 * 60 || t < 6 * 60;
  }, [gameTime]);

  // Notte “blu/viola”: overlay più scuro, ma con tinta (non nero)
  const nightOpacity = useMemo(() => {
    const t = gameTime.hours * 60 + gameTime.minutes;
    if (t >= 18 * 60 || t < 6 * 60) {
      if (t >= 18 * 60) {
        const minutesFrom18 = t - 18 * 60;
        const progress = Math.min(1, minutesFrom18 / 60);
        return 0.75 + progress * 0.20; // 0.75 -> 0.95
      }
      const progress = t / (6 * 60);
      return 0.95 * (1 - progress);
    }
    return 0;
  }, [gameTime]);

  // Regole blocchi (celle intere)
  const isBlocked = (p: Point, allowTarget?: Point) => {
    if (allowTarget && p.x === allowTarget.x && p.y === allowTarget.y) return false;
    if (!(p.x >= 0 && p.x < GRID_SIZE && p.y >= 0 && p.y < LAND_ROWS)) return true;
    if (isRiver(p.x, p.y) && !isBridge(p.x, p.y)) return true;
    if (isTree(p.x, p.y)) return true;
    if (isMine(p.x, p.y)) return true;
    if (isInsideBuilding(castleData, p.x, p.y)) return true;
    if (isInsideBuilding(farmData, p.x, p.y)) return true;
    for (const h of houseData) if (isInsideBuilding(h, p.x, p.y)) return true;
    return false;
  };

  const findPath = (start: Point, target: Point): Point[] | null => {
    const q: Array<{ p: Point; path: Point[] }> = [{ p: start, path: [] }];
    const visited = new Set<string>();
    const dirs = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 }
    ];
    while (q.length) {
      const cur = q.shift()!;
      const key = `${cur.p.x},${cur.p.y}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (cur.p.x === target.x && cur.p.y === target.y) return [...cur.path, cur.p];
      for (const d of dirs) {
        const np = { x: cur.p.x + d.x, y: cur.p.y + d.y };
        const nKey = `${np.x},${np.y}`;
        if (visited.has(nKey)) continue;
        if (isBlocked(np, target)) continue;
        q.push({ p: np, path: [...cur.path, cur.p] });
      }
    }
    return null;
  };

  const stepAlongPath = (from: Point, path: Point[]) => {
    const idx = path.findIndex((p) => p.x === from.x && p.y === from.y);
    if (idx >= 0 && idx < path.length - 1) return path[idx + 1];
    return null;
  };

  // Generazione alberi/miniere/personaggi (nomi sempre random)
  const generateTrees = () => {
    const treeList: Placed[] = [];
    const numTrees = 22;
    for (let i = 0; i < numTrees; i++) {
      let x = 0;
      let y = 0;
      let attempts = 0;
      do {
        x = Math.floor(Math.random() * GRID_SIZE);
        y = Math.floor(Math.random() * LAND_ROWS);
        attempts++;
      } while (
        attempts < 400 &&
        (isRiver(x, y) ||
          isInsideBuilding(castleData, x, y) ||
          isInsideBuilding(farmData, x, y) ||
          houseData.some((h) => isInsideBuilding(h, x, y)) ||
          treeList.some((t) => t.x === x && t.y === y))
      );
      if (attempts < 400) treeList.push({ x, y, id: i });
    }
    return treeList;
  };

  const generateMines = () => {
    const mineList: Placed[] = [];
    const numMines = 10;
    for (let i = 0; i < numMines; i++) {
      let x = 0;
      let y = 0;
      let attempts = 0;
      do {
        x = Math.floor(Math.random() * GRID_SIZE);
        y = Math.floor(Math.random() * LAND_ROWS);
        attempts++;
      } while (
        attempts < 400 &&
        (isRiver(x, y) ||
          isInsideBuilding(castleData, x, y) ||
          isInsideBuilding(farmData, x, y) ||
          houseData.some((h) => isInsideBuilding(h, x, y)) ||
          mineList.some((m) => m.x === x && m.y === y))
      );
      if (attempts < 400) mineList.push({ x, y, id: i });
    }
    return mineList;
  };

  const generateCharacters = (newTrees: Placed[], newMines: Placed[]) => {
    const list: Character[] = [];
    for (let i = 0; i < NUM_CHARACTERS; i++) {
      const profession = professions[i];
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      let x = 0;
      let y = 0;
      let attempts = 0;
      do {
        x = Math.floor(Math.random() * GRID_SIZE);
        y = Math.floor(Math.random() * LAND_ROWS);
        attempts++;
      } while (
        attempts < 400 &&
        (isRiver(x, y) ||
          isInsideBuilding(castleData, x, y) ||
          isInsideBuilding(farmData, x, y) ||
          houseData.some((h) => isInsideBuilding(h, x, y)) ||
          newTrees.some((t) => t.x === x && t.y === y) ||
          newMines.some((m) => m.x === x && m.y === y))
      );
      list.push({
        id: i,
        x,
        y,
        targetX: x,
        targetY: y,
        emoji: profession.emoji,
        profession: profession.name,
        name: `${firstName} ${lastName}`,
        lastMove: Date.now(),
        isInHouse: false
      });
    }
    return list;
  };

  const reset = () => {
    setSelectedCharacter(null);
    setSelectedBuilding(null);
    setSelectedRiver(null);
    setUnreachable({ open: false, message: "" });
    setViewOffset({ x: 0, y: 0 });
    setZoom(1);
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
    setHouseAssignments({ "house-1": null, "house-2": null, "house-3": null, "house-4": null });

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
    if (isDragging) return true;
    if (dragInfoRef.current.didDrag) return true;
    return Date.now() - lastDragAtRef.current < 180;
  };

  // Camera clamp: NON si può andare oltre la griglia
  const clampOffsetToBounds = (o: Point, z: number) => {
    const { width, height } = Dimensions.get("window");
    const gridW = gridPixelSize.w * z;
    const gridH = gridPixelSize.h * z;
    const minLeft = Math.min(0, width - gridW);
    const minTop = Math.min(0, height - gridH);
    const maxLeft = 0;
    const maxTop = 0;
    return { x: clamp(o.x, minLeft, maxLeft), y: clamp(o.y, minTop, maxTop) };
  };

  useEffect(() => {
    setViewOffset((o) => clampOffsetToBounds(o, zoom));
  }, [zoom, gridPixelSize.h, gridPixelSize.w]);

  // Touch pan/pinch
  const getTouchDistance = (touches: any) => {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = (e: any) => {
    const t = e.nativeEvent.touches;
    if (t.length === 2) {
      lastTouchDistance.current = getTouchDistance(t);
      setIsDragging(false);
      return;
    }
    if (t.length === 1) {
      setIsDragging(true);
      dragInfoRef.current = { startX: t[0].pageX, startY: t[0].pageY, didDrag: false };
      dragStart.current = { x: t[0].pageX - viewOffset.x, y: t[0].pageY - viewOffset.y };
    }
  };

  const onTouchMove = (e: any) => {
    const t = e.nativeEvent.touches;
    if (t.length === 2 && lastTouchDistance.current) {
      const dist = getTouchDistance(t);
      const delta = (dist - lastTouchDistance.current) * 0.004;
      const newZoom = clamp(zoom + delta, 0.6, 2.2);
      setZoom(newZoom);
      lastTouchDistance.current = dist;
      return;
    }
    if (t.length === 1 && isDragging) {
      const dx = t[0].pageX - dragInfoRef.current.startX;
      const dy = t[0].pageY - dragInfoRef.current.startY;
      if (!dragInfoRef.current.didDrag && Math.hypot(dx, dy) > 6) dragInfoRef.current.didDrag = true;
      const nextOffset = { x: t[0].pageX - dragStart.current.x, y: t[0].pageY - dragStart.current.y };
      setViewOffset(clampOffsetToBounds(nextOffset, zoom));
    }
  };

  const onTouchEnd = (e: any) => {
    const t = e.nativeEvent.touches;
    if (!t || t.length === 0) {
      setIsDragging(false);
      if (dragInfoRef.current.didDrag) lastDragAtRef.current = Date.now();
    }
    if (!t || t.length < 2) lastTouchDistance.current = null;
  };

  // Mouse wheel zoom (web)
  const handleWheel = (e: any) => {
    if (typeof window === "undefined") return;
    const ne = e.nativeEvent;
    if (!ne || typeof ne.deltaY === "undefined") return;
    e.preventDefault();
    const delta = ne.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = clamp(zoom + delta, 0.6, 2.2);
    setZoom(newZoom);
  };

  // Mouse pan (web)
  const handleMouseDown = (e: any) => {
    if (typeof window === "undefined") return;
    const ne = e?.nativeEvent;
    const x = ne?.clientX ?? 0;
    const y = ne?.clientY ?? 0;
    setIsDragging(true);
    dragInfoRef.current = { startX: x, startY: y, didDrag: false };
    dragStart.current = { x: x - viewOffset.x, y: y - viewOffset.y };
  };
  const handleMouseMove = (e: any) => {
    if (typeof window === "undefined") return;
    if (!isDragging) return;
    const ne = e?.nativeEvent;
    const x = ne?.clientX ?? 0;
    const y = ne?.clientY ?? 0;
    const dx = x - dragInfoRef.current.startX;
    const dy = y - dragInfoRef.current.startY;
    if (!dragInfoRef.current.didDrag && Math.hypot(dx, dy) > 6) dragInfoRef.current.didDrag = true;
    const nextOffset = { x: x - dragStart.current.x, y: y - dragStart.current.y };
    setViewOffset(clampOffsetToBounds(nextOffset, zoom));
  };
  const handleMouseUp = () => {
    if (typeof window === "undefined") return;
    if (dragInfoRef.current.didDrag) lastDragAtRef.current = Date.now();
    setIsDragging(false);
  };

  // Animazione verso target (smooth)
  useEffect(() => {
    const anim = setInterval(() => {
      setCharacters((prev) =>
        prev.map((c) => {
          const dx = c.targetX - c.x;
          const dy = c.targetY - c.y;
          const speed = 0.08;
          if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return { ...c, x: c.targetX, y: c.targetY };
          return { ...c, x: c.x + dx * speed, y: c.y + dy * speed };
        })
      );
    }, 16);
    return () => clearInterval(anim);
  }, []);

  // Movimento “a scatti” (sempre su interi) + script Re/Contadino + notte in casa
  useEffect(() => {
    const interval = setInterval(() => {
      setCharacters((prev) => {
        const byId = new Map(prev.map((c) => [c.id, c]));
        const getAssignedHouse = (charId: number): Building | null => {
          const houseId = Object.entries(houseAssignments).find(([, v]) => v === charId)?.[0];
          if (!houseId) return null;
          return houseData.find((h) => h.id === houseId) ?? null;
        };

        return prev.map((char) => {
          const now = Date.now();
          const gridPos = { x: Math.round(char.targetX), y: Math.round(char.targetY) };

          // Giorno: escono dalla casa
          if (!isNight && char.isInHouse) {
            return { ...char, isInHouse: false, lastMove: now };
          }

          // Notte: gli abitanti assegnati vanno in casa e restano dentro
          const assignedHouse = getAssignedHouse(char.id);
          if (isNight && assignedHouse) {
            const target = buildingCenter(assignedHouse);
            if (gridPos.x === target.x && gridPos.y === target.y) {
              return { ...char, isInHouse: true, lastMove: now, targetX: target.x, targetY: target.y };
            }
            if (char.isInHouse) return char;
            const path = findPath(gridPos, target);
            if (!path) return char;
            const next = stepAlongPath(gridPos, path);
            if (!next) return char;
            return { ...char, targetX: next.x, targetY: next.y, lastMove: now, isInHouse: false };
          }

          // Se dentro castello/campo resta fermo
          if (char.isInCastle || char.isInFarm) return char;

          // Delay
          const timeSince = now - char.lastMove;
          const moveDelay = 1600 + char.id * 160;
          if (timeSince < moveDelay) return char;

          // Re -> castello (BFS)
          if (char.profession === "Re" && kingGoingToCastle) {
            const target = buildingCenter(castleData);
            if (gridPos.x === target.x && gridPos.y === target.y) {
              setKingGoingToCastle(false);
              setKingPath([]);
              return { ...char, targetX: target.x, targetY: target.y, x: target.x, y: target.y, isInCastle: true, lastMove: now };
            }
            const path = kingPath.length ? kingPath : findPath(gridPos, target);
            if (!path) {
              setKingGoingToCastle(false);
              setKingPath([]);
              setUnreachable({ open: true, message: "Il Re non può raggiungere il castello." });
              return char;
            }
            if (!kingPath.length) setKingPath(path);
            const next = stepAlongPath(gridPos, path);
            if (!next) return { ...char, lastMove: now };
            return { ...char, targetX: next.x, targetY: next.y, lastMove: now };
          }

          // Contadino -> campo (BFS)
          if (char.profession === "Contadino" && farmerGoingToFarm) {
            const target = buildingCenter(farmData);
            if (gridPos.x === target.x && gridPos.y === target.y) {
              setFarmerGoingToFarm(false);
              setFarmerPath([]);
              return { ...char, targetX: target.x, targetY: target.y, x: target.x, y: target.y, isInFarm: true, lastMove: now };
            }
            const path = farmerPath.length ? farmerPath : findPath(gridPos, target);
            if (!path) {
              setFarmerGoingToFarm(false);
              setFarmerPath([]);
              setUnreachable({ open: true, message: "Postazione irraggiungibile: il Contadino non può raggiungere il campo." });
              return char;
            }
            if (!farmerPath.length) setFarmerPath(path);
            const next = stepAlongPath(gridPos, path);
            if (!next) return { ...char, lastMove: now };
            return { ...char, targetX: next.x, targetY: next.y, lastMove: now };
          }

          // Movimento casuale: usa SOLO coordinate intere e non entra in fiume senza ponte / alberi / miniere
          const dirs = [
            { x: 0, y: -1 },
            { x: 0, y: 1 },
            { x: -1, y: 0 },
            { x: 1, y: 0 }
          ].sort(() => Math.random() - 0.5);

          for (const d of dirs) {
            const np = { x: gridPos.x + d.x, y: gridPos.y + d.y };
            if (isBlocked(np)) continue;
            return { ...char, targetX: np.x, targetY: np.y, lastMove: now };
          }

          return { ...char, lastMove: now };
        });
      });
    }, 450);

    return () => clearInterval(interval);
  }, [bridges, trees, mines, kingGoingToCastle, farmerGoingToFarm, kingPath, farmerPath, isNight, houseAssignments]);

  // Ricalcolo percorsi quando cambiano ponti
  useEffect(() => {
    if (farmerGoingToFarm) {
      const farmer = characters.find((c) => c.profession === "Contadino");
      if (farmer && !farmer.isInFarm) {
        const start = { x: Math.round(farmer.targetX), y: Math.round(farmer.targetY) };
        const target = buildingCenter(farmData);
        const path = findPath(start, target);
        if (path) setFarmerPath(path);
      }
    }
    if (kingGoingToCastle) {
      const king = characters.find((c) => c.profession === "Re");
      if (king && !king.isInCastle) {
        const start = { x: Math.round(king.targetX), y: Math.round(king.targetY) };
        const target = buildingCenter(castleData);
        const path = findPath(start, target);
        if (path) setKingPath(path);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridges]);

  // UI actions
  const handleCallKing = async () => {
    const king = characters.find((c) => c.profession === "Re");
    if (!king) return;
    const start = { x: Math.round(king.targetX), y: Math.round(king.targetY) };
    const target = buildingCenter(castleData);
    const path = findPath(start, target);
    if (!path) {
      setUnreachable({ open: true, message: "Il Re non può raggiungere il castello." });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setKingPath(path);
    setKingGoingToCastle(true);
    setSelectedBuilding(null);
    setSelectedRiver(null);
    setSelectedCharacter(null);
    await Haptics.selectionAsync();
  };

  const handleCallFarmer = async () => {
    const farmer = characters.find((c) => c.profession === "Contadino");
    if (!farmer) return;
    const start = { x: Math.round(farmer.targetX), y: Math.round(farmer.targetY) };
    const target = buildingCenter(farmData);
    const path = findPath(start, target);
    if (!path) {
      setUnreachable({ open: true, message: "Postazione irraggiungibile: il Contadino non può raggiungere il campo." });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setFarmerPath(path);
    setFarmerGoingToFarm(true);
    setSelectedBuilding(null);
    setSelectedRiver(null);
    setSelectedCharacter(null);
    await Haptics.selectionAsync();
  };

  const handleZoomIn = async () => {
    setZoom((z) => clamp(z + 0.2, 0.6, 2.2));
    await Haptics.selectionAsync();
  };
  const handleZoomOut = async () => {
    setZoom((z) => clamp(z - 0.2, 0.6, 2.2));
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

  const buildBridge = async () => {
    if (!selectedRiver) return;
    setBridges((prev) => [...prev, { x: selectedRiver.x, y: selectedRiver.y }]);
    setSelectedRiver(null);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const buildLight = async (x: number, y: number) => {
    if (wasRecentlyDragging()) return;
    if (buildMode !== "light") return;
    
    // Solo su erba (non fiume, non edifici, non alberi, non miniere, non già luce)
    if (isRiver(x, y) || isInsideBuilding(castleData, x, y) || isInsideBuilding(farmData, x, y) || 
        houseData.some((h) => isInsideBuilding(h, x, y)) || isTree(x, y) || isMine(x, y) || 
        isLight(x, y) || isSea(x, y) || isBeach(x, y)) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    
    const newLight: Light = { x, y, id: lights.length };
    setLights((prev) => [...prev, newLight]);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const closeModal = () => {
    setSelectedCharacter(null);
    setSelectedBuilding(null);
    setSelectedRiver(null);
    setIsClockModalOpen(false);
  };

  // Render griglia
  const gridCells = useMemo(() => {
    const cells: React.ReactNode[] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const river = isRiver(x, y);
        const bridge = isBridge(x, y);
        const castle = isInsideBuilding(castleData, x, y);
        const farm = isInsideBuilding(farmData, x, y);
        const house = houseData.some((h) => isInsideBuilding(h, x, y));
        const sea = isSea(x, y);
        const beach = isBeach(x, y);
        const tree = isTree(x, y);
        const mine = isMine(x, y);
        const light = isLight(x, y);
        const illuminated = isIlluminated(x, y);

        let bg = "#2f9e44";
        if (sea) bg = "#1c7ed6";
        else if (beach) bg = "#ffd43b";
        else if (river && !bridge) bg = "#4dabf7";
        else if (bridge) bg = "#8d5a2b";
        else if (castle) bg = "#495057";
        else if (farm) bg = "#b08900";
        else if (house) bg = "#6c757d";
        
        // Illuminazione: rende le caselle più chiare
        if (illuminated && !sea && !beach && !river && !castle && !farm && !house) {
          bg = "#4ade80"; // verde più chiaro per erba illuminata
        }

        const emoji = bridge ? "🌉" : tree ? "🌲" : mine ? "⛏️" : light ? "💡" : null;
        const emojiSize = tree || mine ? 20 : light ? 22 : 18;

        cells.push(
          <Pressable
            key={`${x}-${y}`}
            onPress={() => {
              if (buildMode === "light") {
                buildLight(x, y);
              } else if (river && !bridge) {
                selectRiver(x, y);
              }
            }}
            style={[
              styles.cell,
              {
                backgroundColor: bg,
                width: CELL_SIZE,
                height: CELL_SIZE,
                margin: CELL_GAP / 2,
                borderColor: selectedRiver && selectedRiver.x === x && selectedRiver.y === y ? "#ffe066" : "rgba(0,0,0,0.10)",
                borderWidth: selectedRiver && selectedRiver.x === x && selectedRiver.y === y ? 2 : 1
              }
            ]}
          >
            {emoji && <Text style={{ fontSize: emojiSize }}>{emoji}</Text>}
          </Pressable>
        );
      }
    }
    return cells;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridges, trees, mines, lights, selectedRiver, isDragging, buildMode]);

  const characterNodes = useMemo(() => {
    return characters.map((c) => {
      const left = c.x * (CELL_SIZE + CELL_GAP) + CELL_SIZE * 0.1;
      const top = c.y * (CELL_SIZE + CELL_GAP) + CELL_SIZE * 0.05;
      return (
        <Pressable
          key={`char-${c.id}`}
          onPress={() => openCharacter(c)}
          style={[styles.char, { left, top, width: CELL_SIZE, height: CELL_SIZE }]}
        >
          <Text style={{ fontSize: 22 }}>{c.emoji}</Text>
        </Pressable>
      );
    });
  }, [characters, isDragging]);

  const buildingNodes = useMemo(() => {
    const nodes: React.ReactNode[] = [];
    const add = (b: Building) => {
      const centerX = (b.x + b.width / 2) * (CELL_SIZE + CELL_GAP) - (CELL_SIZE + CELL_GAP) / 2;
      const centerY = (b.y + b.height / 2) * (CELL_SIZE + CELL_GAP) - (CELL_SIZE + CELL_GAP) / 2;
      nodes.push(
        <Pressable key={`building-${b.id}`} onPress={() => openBuilding(b)} style={[styles.building, { left: centerX, top: centerY }]}>
          <Text style={{ fontSize: b.type === "house" ? 30 : 36 }}>{b.emoji}</Text>
        </Pressable>
      );
    };
    add(castleData);
    add(farmData);
    houseData.forEach(add);
    return nodes;
  }, [isDragging]);

  const transformStyle = useMemo(
    () => ({ transform: [{ translateX: viewOffset.x }, { translateY: viewOffset.y }, { scale: zoom }] }),
    [viewOffset.x, viewOffset.y, zoom]
  );

  const assignedCharacterIdForHouse = (houseId: string) => houseAssignments[houseId] ?? null;
  const assignToHouse = (houseId: string, charId: number | null) => {
    setHouseAssignments((prev) => ({ ...prev, [houseId]: charId }));
  };

  return (
    <View style={styles.root}>
      {/* HUD in alto con orologio + reset/zoom */}
      <View style={styles.topHud}>
        <Pressable
          style={styles.clockContainer}
          onPress={() => {
            setClockDraftMinutes((gameTime.hours * 60 + gameTime.minutes) % (24 * 60));
            setIsClockModalOpen(true);
          }}
        >
          <Text style={styles.clockText}>🕐 {formatGameTime(gameTime.hours, gameTime.minutes)}</Text>
        </Pressable>
        <View style={styles.topHudButtons}>
          <Pressable style={styles.btn} onPress={reset}>
            <Text style={styles.btnText}>↻ Reset</Text>
          </Pressable>
          <Pressable 
            style={[styles.btn, buildMode === "light" && styles.btnActive]} 
            onPress={() => setBuildMode(buildMode === "light" ? null : "light")}
          >
            <Text style={styles.btnText}>💡 Costruisci</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={handleZoomOut}>
            <Text style={styles.btnText}>− Zoom</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={handleZoomIn}>
            <Text style={styles.btnText}>＋ Zoom</Text>
          </Pressable>
        </View>
      </View>

      <View
        style={styles.stage}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onTouchStart}
        onResponderMove={onTouchMove}
        onResponderRelease={onTouchEnd}
        onResponderTerminate={onTouchEnd}
        // @ts-ignore
        onMouseDown={handleMouseDown}
        // @ts-ignore
        onMouseMove={handleMouseMove}
        // @ts-ignore
        onMouseUp={handleMouseUp}
        // @ts-ignore
        onMouseLeave={handleMouseUp}
        // @ts-ignore
        onWheel={handleWheel}
      >
        <View style={[styles.world, transformStyle]}>
          <View style={[styles.grid, { width: gridPixelSize.w, height: gridPixelSize.h }]}>{gridCells}</View>
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            {buildingNodes}
            {characterNodes}
          </View>
        </View>

        {/* Overlay notte tinta blu/viola */}
        {nightOpacity > 0 && (
          <>
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#0b1026", opacity: nightOpacity }]} />
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#2b1140", opacity: nightOpacity * 0.18 }]} />
          </>
        )}
      </View>

      {/* Dialog irraggiungibile */}
      <Modal visible={unreachable.open} transparent animationType="fade" onRequestClose={() => setUnreachable({ open: false, message: "" })}>
        <Pressable style={styles.modalBackdrop} onPress={() => setUnreachable({ open: false, message: "" })}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>⚠️ Postazione irraggiungibile</Text>
            <Text style={styles.modalSub}>{unreachable.message}</Text>
            <Text style={styles.modalHint}>Suggerimento: costruisci ponti e libera il percorso da ostacoli.</Text>
            <Pressable style={[styles.btnPrimary, { marginTop: 12 }]} onPress={() => setUnreachable({ open: false, message: "" })}>
              <Text style={styles.btnTextPrimary}>Chiudi</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modale info */}
      <Modal visible={!!(selectedCharacter || selectedBuilding || selectedRiver) || isClockModalOpen} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeModal}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            {isClockModalOpen && (
              <>
                <Text style={styles.modalTitle}>🕐 Imposta orario</Text>
                <Text style={styles.modalSub}>Ora attuale: {formatGameTime(gameTime.hours, gameTime.minutes)}</Text>
                <Text style={styles.modalSub}>
                  Nuova ora: {formatGameTime(Math.floor(clockDraftMinutes / 60) % 24, clockDraftMinutes % 60)}
                </Text>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <Pressable style={styles.btn} onPress={() => setClockDraftMinutes((m) => (m + 24 * 60 - 60) % (24 * 60))}>
                    <Text style={styles.btnText}>−1h</Text>
                  </Pressable>
                  <Pressable style={styles.btn} onPress={() => setClockDraftMinutes((m) => (m + 60) % (24 * 60))}>
                    <Text style={styles.btnText}>＋1h</Text>
                  </Pressable>
                  <Pressable style={styles.btn} onPress={() => setClockDraftMinutes((m) => (m + 24 * 60 - 15) % (24 * 60))}>
                    <Text style={styles.btnText}>−15m</Text>
                  </Pressable>
                  <Pressable style={styles.btn} onPress={() => setClockDraftMinutes((m) => (m + 15) % (24 * 60))}>
                    <Text style={styles.btnText}>＋15m</Text>
                  </Pressable>
                </View>
                <Pressable
                  style={[styles.btnPrimary, { marginTop: 12 }]}
                  onPress={() => {
                    setGameTimeBaseMinutes(clockDraftMinutes);
                    gameTimeStartRef.current = Date.now();
                    setIsClockModalOpen(false);
                  }}
                >
                  <Text style={styles.btnTextPrimary}>Applica</Text>
                </Pressable>
              </>
            )}

            {selectedCharacter && (
              <>
                <Text style={styles.modalTitle}>
                  {selectedCharacter.emoji} {selectedCharacter.name}
                </Text>
                <Text style={styles.modalSub}>Professione: {selectedCharacter.profession}</Text>
                <Text style={styles.modalSub}>
                  Posizione: ({Math.round(selectedCharacter.x)}, {Math.round(selectedCharacter.y)})
                </Text>
              </>
            )}

            {selectedBuilding && (
              <>
                <Text style={styles.modalTitle}>
                  {selectedBuilding.emoji} {selectedBuilding.name}
                </Text>
                <Text style={styles.modalSub}>{selectedBuilding.description}</Text>

                {selectedBuilding.type === "castle" && (
                  <>
                    <Text style={styles.modalHint}>Premi per chiamare il Re.</Text>
                    <Pressable style={[styles.btnPrimary, { marginTop: 12 }]} onPress={handleCallKing}>
                      <Text style={styles.btnTextPrimary}>Chiama Re</Text>
                    </Pressable>
                  </>
                )}
                {selectedBuilding.type === "farm" && (
                  <>
                    <Text style={styles.modalHint}>Premi per chiamare il Contadino.</Text>
                    <Pressable style={[styles.btnPrimary, { marginTop: 12 }]} onPress={handleCallFarmer}>
                      <Text style={styles.btnTextPrimary}>Chiama Contadino</Text>
                    </Pressable>
                  </>
                )}
                {selectedBuilding.type === "house" && (
                  <>
                    <Text style={styles.modalHint}>Assegna un abitante: dalle 18:00 alle 6:00 rientra in casa.</Text>
                    <Text style={styles.modalSub}>
                      Attuale:{" "}
                      {(() => {
                        const id = assignedCharacterIdForHouse(selectedBuilding.id);
                        const c = characters.find((x) => x.id === id);
                        return c ? `${c.emoji} ${c.name}` : "Nessuno";
                      })()}
                    </Text>
                    <View style={{ marginTop: 8, gap: 8 }}>
                      <Pressable style={styles.btn} onPress={() => assignToHouse(selectedBuilding.id, null)}>
                        <Text style={styles.btnText}>Rimuovi abitante</Text>
                      </Pressable>
                      {characters.map((c) => (
                        <Pressable key={`assign-${selectedBuilding.id}-${c.id}`} style={styles.btn} onPress={() => assignToHouse(selectedBuilding.id, c.id)}>
                          <Text style={styles.btnText}>
                            Assegna: {c.emoji} {c.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={styles.modalHint}>Stato notte: {isNight ? "NOTTE (rientrano)" : "GIORNO (escono)"}</Text>
                  </>
                )}
              </>
            )}

            {selectedRiver && (
              <>
                <Text style={styles.modalTitle}>💧 Fiume</Text>
                <Text style={styles.modalSub}>
                  Casella: ({selectedRiver.x}, {selectedRiver.y})
                </Text>
                <Text style={styles.modalHint}>Costruisci un ponte per permettere il passaggio (nessuno può entrare nel fiume senza ponte).</Text>
                <Pressable style={[styles.btnWarn, { marginTop: 12 }]} onPress={buildBridge}>
                  <Text style={styles.btnTextPrimary}>Costruisci ponte</Text>
                </Pressable>
              </>
            )}

            <Pressable style={[styles.btnPrimary, { marginTop: 12 }]} onPress={closeModal}>
              <Text style={styles.btnTextPrimary}>Chiudi</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b3d1f" },
  topHud: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    zIndex: 1000,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10
  },
  clockContainer: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)"
  },
  topHudButtons: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  clockText: { color: "#ffffff", fontSize: 16, fontWeight: "700", fontFamily: "monospace" },
  stage: {
    flex: 1,
    backgroundColor: "#1b5e20",
    // @ts-ignore
    userSelect: "none",
    WebkitUserSelect: "none"
  },
  world: { position: "absolute", left: 0, top: 0 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: CELL_GAP / 2,
    // @ts-ignore
    userSelect: "none",
    WebkitUserSelect: "none"
  },
  cell: { borderRadius: 10, alignItems: "center", justifyContent: "center" },
  char: { position: "absolute", alignItems: "center", justifyContent: "center" },
  building: { position: "absolute", alignItems: "center", justifyContent: "center" },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)"
  },
  btnActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderColor: "rgba(255,255,255,0.4)"
  },
  btnPrimary: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#2f9e44" },
  btnWarn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#f59f00" },
  btnText: { color: "white", fontWeight: "700" },
  btnTextPrimary: { color: "#08210f", fontWeight: "900" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 18 },
  modalCard: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 18,
    backgroundColor: "#0f2b18",
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)"
  },
  modalTitle: { color: "white", fontSize: 18, fontWeight: "900", marginBottom: 8 },
  modalSub: { color: "rgba(255,255,255,0.85)", fontSize: 14, marginBottom: 6 },
  modalHint: { color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 8 }
});
