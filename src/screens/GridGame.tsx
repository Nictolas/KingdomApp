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
import { clamp, isInsideBuilding, buildingCenter, isTree, isMine } from "../utils";
import { generateTrees, generateMines, generateCharacters } from "../game/generation";
import { isRiver, isSea, isBeach, makeTerrainColor } from "../game/terrain";
import { isLightAt, isIlluminatedByAnyLight } from "../game/lights";
import { computeNightOpacity } from "../game/night";
import { blendHex } from "../game/color";
import { TopHud } from "../ui/TopHud";
import { BuildMenuModal } from "../ui/BuildMenuModal";
import { UnreachableModal } from "../ui/UnreachableModal";
import { useCamera } from "../camera/useCamera";

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
  
  const viewOffset = camera.offset;
  const zoom = camera.zoom;
  
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

  // Case: assegnazione abitanti (ogni casa può ospitare 2 persone)
  const [houseAssignments, setHouseAssignments] = useState<Record<string, number[]>>({
    "house-1": [],
    "house-2": [],
    "house-3": [],
    "house-4": []
  });


  // Terreni (importati da game/terrain.ts)

  const isBridge = (x: number, y: number) => bridges.some((b) => b.x === x && b.y === y);
  // Luci (importate da game/lights.ts)

  const formatGameTime = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const isNight = useMemo(() => {
    const t = gameTime.hours * 60 + gameTime.minutes;
    return t >= 18 * 60 || t < 6 * 60;
  }, [gameTime]);

  // Notte (importata da game/night.ts)
  const nightOpacity = useMemo(() => computeNightOpacity(gameTime.hours, gameTime.minutes), [gameTime]);

  // Regole blocchi (celle intere)
  const isBlocked = (p: Point, allowTarget?: Point) => {
    if (allowTarget && p.x === allowTarget.x && p.y === allowTarget.y) return false;
    // Consentiamo movimento anche sulla fascia spiaggia, perché il fiume arriva fino al mare
    // e i ponti possono essere costruiti anche lì. Vietiamo invece il mare.
    if (!(p.x >= 0 && p.x < GRID_SIZE && p.y >= 0 && p.y < GRID_SIZE - SEA_ROWS)) return true;
    // Spiaggia non attraversabile (salvo fiume/ponte che la attraversa)
    if (isBeach(p.x, p.y) && !isRiver(p.x, p.y)) return true;
    if (isRiver(p.x, p.y) && !isBridge(p.x, p.y)) return true;
    if (isTree(p.x, p.y, trees)) return true;
    if (isMine(p.x, p.y, mines)) return true;
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


  const reset = () => {
    setSelectedCharacter(null);
    setSelectedBuilding(null);
    setSelectedRiver(null);
    setUnreachable({ open: false, message: "" });
    // Reset camera: zoom e offset vengono resettati automaticamente dal hook quando cambiano le dimensioni
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

  // Camera gestita da hook useCamera (vedi sopra)

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
          const houseId = Object.entries(houseAssignments).find(([, v]) => Array.isArray(v) && v.includes(charId))?.[0];
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

  const buildBridge = async () => {
    if (!selectedRiver) return;
    // Il fiume è largo 2 colonne (RIVER_XS). Un “ponte” deve coprire tutte le colonne del fiume
    // alla stessa y, altrimenti i personaggi restano bloccati sulla seconda colonna.
    setBridges((prev) => {
      const next = [...prev];
      for (const rx of RIVER_XS) {
        if (!next.some((b) => b.x === rx && b.y === selectedRiver.y)) next.push({ x: rx, y: selectedRiver.y });
      }
      return next;
    });
    setSelectedRiver(null);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const buildBridgeAt = async (x: number, y: number) => {
    if (wasRecentlyDragging()) return;
    if (!isRiver(x, y)) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setBridges((prev) => {
      const next = [...prev];
      for (const rx of RIVER_XS) {
        if (!next.some((b) => b.x === rx && b.y === y)) next.push({ x: rx, y });
      }
      return next;
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const buildLight = async (x: number, y: number) => {
    if (wasRecentlyDragging()) return;
    if (buildMode !== "light") return;
    
    // Solo su erba (non fiume, non edifici, non alberi, non miniere, non già luce)
    if (isRiver(x, y) || isInsideBuilding(castleData, x, y) || isInsideBuilding(farmData, x, y) || 
        houseData.some((h) => isInsideBuilding(h, x, y)) || isTree(x, y, trees) || isMine(x, y, mines) || 
        isLightAt(lights, x, y) || isSea(x, y) || isBeach(x, y)) {
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
        const tree = isTree(x, y, trees);
        const mine = isMine(x, y, mines);
        const light = isLightAt(lights, x, y);
        const illuminated = isIlluminatedByAnyLight(lights, x, y);

        const bg = makeTerrainColor({
          x,
          y,
          isRiver: river,
          isSea: sea,
          isBeach: beach,
          isBridge: bridge,
          isCastle: castle,
          isFarm: farm,
          isHouse: house,
          isIlluminated: illuminated,
          isLight: light,
          nightOpacity,
          blendHex
        });

        const emoji = bridge ? "🌉" : tree ? "🌲" : mine ? "⛰️" : light ? "💡" : null;
        const emojiSize = tree || mine ? 20 : light ? 22 : 18;

        const left = x * (CELL_SIZE + CELL_GAP);
        const top = y * (CELL_SIZE + CELL_GAP);
        
        cells.push(
          <Pressable
            key={`${x}-${y}`}
            onPress={() => {
              if (buildMode === "light") {
                buildLight(x, y);
              } else if (buildMode === "bridge") {
                if (river && !bridge) {
                  buildBridgeAt(x, y);
                }
              } else if (river && !bridge) {
                selectRiver(x, y);
              }
            }}
            style={[
              styles.cell,
              {
                position: "absolute",
                left,
                top,
                backgroundColor: bg,
                width: CELL_SIZE,
                height: CELL_SIZE,
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
  }, [bridges, trees, mines, lights, selectedRiver, camera.isDragging, buildMode]);

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
  }, [characters, camera.isDragging]);

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
  }, [camera.isDragging]);

  // Transform style gestito dal hook camera
  const transformStyle = camera.transformStyle;

  const assignedCharactersForHouse = (houseId: string) => houseAssignments[houseId] ?? [];
  const assignToHouse = (houseId: string, charId: number | null) => {
    setHouseAssignments((prev) => {
      const current = prev[houseId] ?? [];
      if (charId === null) {
        // Rimuovi tutte le assegnazioni per questa casa
        return { ...prev, [houseId]: [] };
      }
      // Aggiungi se non c'è già e se c'è spazio (max 2)
      if (current.includes(charId)) {
        // Rimuovi se già presente
        return { ...prev, [houseId]: current.filter((id) => id !== charId) };
      }
      if (current.length >= 2) {
        // Casa piena
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
          <View style={[styles.grid, { width: gridPixelSize.w, height: gridPixelSize.h }]}>{gridCells}</View>
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            {buildingNodes}
            {characterNodes}
          </View>
        </View>

        {/* Notte: applicata per-cella nella griglia (così le luci restano luminose) */}
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
                <Text style={styles.modalSub}>Età: {selectedCharacter.age} anni</Text>
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
                      Abitanti attuali ({assignedCharactersForHouse(selectedBuilding.id).length}/2):{" "}
                      {assignedCharactersForHouse(selectedBuilding.id).length === 0
                        ? "Nessuno"
                        : assignedCharactersForHouse(selectedBuilding.id)
                            .map((id) => {
                              const c = characters.find((x) => x.id === id);
                              return c ? `${c.emoji} ${c.name}` : "";
                            })
                            .filter(Boolean)
                            .join(", ")}
                    </Text>
                    <View style={{ marginTop: 8, gap: 8 }}>
                      {assignedCharactersForHouse(selectedBuilding.id).length > 0 && (
                        <Pressable style={styles.btn} onPress={() => assignToHouse(selectedBuilding.id, null)}>
                          <Text style={styles.btnText}>Rimuovi tutti</Text>
                        </Pressable>
                      )}
                      {characters.map((c) => {
                        const assigned = assignedCharactersForHouse(selectedBuilding.id);
                        const isAssigned = assigned.includes(c.id);
                        const canAssign = assigned.length < 2;
                        return (
                          <Pressable
                            key={`assign-${selectedBuilding.id}-${c.id}`}
                            style={[styles.btn, isAssigned && styles.btnActive]}
                            onPress={() => assignToHouse(selectedBuilding.id, isAssigned ? null : c.id)}
                            disabled={!isAssigned && !canAssign}
                          >
                            <Text style={styles.btnText}>
                              {isAssigned ? "✓ " : ""}
                              {c.emoji} {c.name} {c.profession}
                              {!isAssigned && !canAssign ? " (Casa piena)" : ""}
                            </Text>
                          </Pressable>
                        );
                      })}
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
    position: "relative",
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
