import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import * as Haptics from "expo-haptics";

type Point = { x: number; y: number };
type Placed = { x: number; y: number; id: number };
type Bridge = { x: number; y: number };

type Building = {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  emoji: string;
  description: string;
  type: "castle" | "farm";
};

type Character = {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  emoji: string;
  profession: string;
  name: string;
  lastMove: number;
  isInCastle?: boolean;
  isInFarm?: boolean;
};

const GRID_SIZE = 20;
const NUM_CHARACTERS = 6;
const CELL_SIZE = 42;
const CELL_GAP = 3;

const professions = [
  { emoji: "👨‍🌾", name: "Contadino" },
  { emoji: "🤴", name: "Re" },
  { emoji: "👨‍🍳", name: "Cuoco" },
  { emoji: "👨‍🔬", name: "Scienziato" },
  { emoji: "👨‍🎨", name: "Artista" },
  { emoji: "🪓", name: "Boscaiolo" }
];

const firstNames = [
  "Marco",
  "Luca",
  "Giovanni",
  "Paolo",
  "Andrea",
  "Francesco",
  "Alessandro",
  "Matteo",
  "Lorenzo",
  "Giuseppe"
];
const lastNames = ["Rossi", "Bianchi", "Verdi", "Romano", "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Conti"];

const castleData: Building = {
  x: 15,
  y: 8,
  width: 3,
  height: 3,
  name: "Castello",
  emoji: "🏰",
  description: "Un maestoso castello medievale",
  type: "castle"
};

const farmData: Building = {
  x: 3,
  y: 15,
  width: 3,
  height: 3,
  name: "Campo",
  emoji: "🌾",
  description: "Un campo coltivato per l'agricoltura",
  type: "farm"
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isInsideBuilding(b: Building, x: number, y: number) {
  return x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height;
}

export default function GridGame() {
  // Stato mondo
  const [bridges, setBridges] = useState<Bridge[]>([]);
  const [trees, setTrees] = useState<Placed[]>([]);
  const [mines, setMines] = useState<Placed[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);

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
  const pinchStart = useRef<{ zoom: number; center: Point; offset: Point } | null>(null);

  // Azioni “story”
  const [kingGoingToCastle, setKingGoingToCastle] = useState(false);
  const [farmerGoingToFarm, setFarmerGoingToFarm] = useState(false);

  const gridPixelSize = useMemo(() => {
    const size = GRID_SIZE * (CELL_SIZE + CELL_GAP);
    return { w: size, h: size };
  }, []);

  const isRiver = (x: number, y: number) => (x === 9 || x === 10) && y < GRID_SIZE - 2;
  const isSea = (_x: number, y: number) => y === GRID_SIZE - 1;
  const isBeach = (_x: number, y: number) => y === GRID_SIZE - 2;

  const isBridge = (x: number, y: number) => bridges.some((b) => b.x === x && b.y === y);
  const isTree = (x: number, y: number) => trees.some((t) => t.x === x && t.y === y);
  const isMine = (x: number, y: number) => mines.some((m) => m.x === x && m.y === y);

  const generateTrees = () => {
    const treeList: Placed[] = [];
    const numTrees = 15;
    for (let i = 0; i < numTrees; i++) {
      let x = 0;
      let y = 0;
      let attempts = 0;
      do {
        x = Math.floor(Math.random() * GRID_SIZE);
        y = Math.floor(Math.random() * (GRID_SIZE - 2));
        attempts++;
      } while (
        attempts < 200 &&
        (isRiver(x, y) ||
          isInsideBuilding(castleData, x, y) ||
          isInsideBuilding(farmData, x, y) ||
          treeList.some((t) => t.x === x && t.y === y))
      );
      if (attempts < 200) treeList.push({ x, y, id: i });
    }
    return treeList;
  };

  const generateMines = () => {
    const mineList: Placed[] = [];
    const numMines = 8;
    for (let i = 0; i < numMines; i++) {
      let x = 0;
      let y = 0;
      let attempts = 0;
      do {
        x = Math.floor(Math.random() * GRID_SIZE);
        y = Math.floor(Math.random() * (GRID_SIZE - 2));
        attempts++;
      } while (
        attempts < 200 &&
        (isRiver(x, y) ||
          isInsideBuilding(castleData, x, y) ||
          isInsideBuilding(farmData, x, y) ||
          mineList.some((m) => m.x === x && m.y === y))
      );
      if (attempts < 200) mineList.push({ x, y, id: i });
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
        y = Math.floor(Math.random() * (GRID_SIZE - 2));
        attempts++;
      } while (
        attempts < 200 &&
        (isRiver(x, y) ||
          isInsideBuilding(castleData, x, y) ||
          isInsideBuilding(farmData, x, y) ||
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
        lastMove: Date.now()
      });
    }
    return list;
  };

  const reset = () => {
    setSelectedCharacter(null);
    setSelectedBuilding(null);
    setSelectedRiver(null);
    setViewOffset({ x: 0, y: 0 });
    setZoom(1);
    setKingGoingToCastle(false);
    setFarmerGoingToFarm(false);
    setBridges([]);

    const newTrees = generateTrees();
    const newMines = generateMines();
    setTrees(newTrees);
    setMines(newMines);
    setCharacters(generateCharacters(newTrees, newMines));
  };

  // init
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // IA movimento “a scatti”
  useEffect(() => {
    const interval = setInterval(() => {
      setCharacters((prev) =>
        prev.map((char) => {
          const atNonWalkable = (nx: number, ny: number) =>
            !(nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE - 2) ||
            (isRiver(nx, ny) && !isBridge(nx, ny)) ||
            isInsideBuilding(castleData, nx, ny) ||
            isInsideBuilding(farmData, nx, ny) ||
            isTree(nx, ny) ||
            isMine(nx, ny);

          // “script” Re -> castello
          if (char.profession === "Re" && kingGoingToCastle) {
            const tx = castleData.x + 1;
            const ty = castleData.y + 1;
            if (Math.abs(char.x - tx) < 0.1 && Math.abs(char.y - ty) < 0.1) {
              setKingGoingToCastle(false);
              return { ...char, x: tx, y: ty, targetX: tx, targetY: ty, isInCastle: true };
            }

            const dx = tx - char.targetX;
            const dy = ty - char.targetY;
            let nx = char.targetX;
            let ny = char.targetY;
            if (Math.abs(dx) > 0) nx += Math.sign(dx);
            else if (Math.abs(dy) > 0) ny += Math.sign(dy);

            if (!atNonWalkable(nx, ny)) return { ...char, targetX: nx, targetY: ny, lastMove: Date.now() };
            return char;
          }

          // “script” Contadino -> campo
          if (char.profession === "Contadino" && farmerGoingToFarm) {
            const tx = farmData.x + 1;
            const ty = farmData.y + 1;
            if (Math.abs(char.x - tx) < 0.1 && Math.abs(char.y - ty) < 0.1) {
              setFarmerGoingToFarm(false);
              return { ...char, x: tx, y: ty, targetX: tx, targetY: ty, isInFarm: true };
            }

            const dx = tx - char.targetX;
            const dy = ty - char.targetY;
            let nx = char.targetX;
            let ny = char.targetY;
            if (Math.abs(dx) > 0) nx += Math.sign(dx);
            else if (Math.abs(dy) > 0) ny += Math.sign(dy);

            if (!atNonWalkable(nx, ny)) return { ...char, targetX: nx, targetY: ny, lastMove: Date.now() };
            return char;
          }

          if (char.isInCastle || char.isInFarm) return char;

          const timeSinceLastMove = Date.now() - char.lastMove;
          const moveDelay = 1700 + char.id * 180;
          if (timeSinceLastMove < moveDelay) return char;

          const dirs = [
            { x: 0, y: -1 },
            { x: 0, y: 1 },
            { x: -1, y: 0 },
            { x: 1, y: 0 }
          ].sort(() => Math.random() - 0.5);

          for (const d of dirs) {
            const nx = char.targetX + d.x;
            const ny = char.targetY + d.y;
            if (!atNonWalkable(nx, ny)) return { ...char, targetX: nx, targetY: ny, lastMove: Date.now() };
          }

          return { ...char, lastMove: Date.now() };
        })
      );
    }, 600);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kingGoingToCastle, farmerGoingToFarm, bridges, trees, mines]);

  // animazione morbida verso target
  useEffect(() => {
    const anim = setInterval(() => {
      setCharacters((prev) =>
        prev.map((char) => {
          const dx = char.targetX - char.x;
          const dy = char.targetY - char.y;
          const speed = 0.06;
          if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return { ...char, x: char.targetX, y: char.targetY };
          return { ...char, x: char.x + dx * speed, y: char.y + dy * speed };
        })
      );
    }, 16);
    return () => clearInterval(anim);
  }, []);

  // Gesture base (drag + pinch)
  const getTouchDistance = (touches: any) => {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = (e: any) => {
    const t = e.nativeEvent.touches;
    if (t.length === 2) {
      const dist = getTouchDistance(t);
      lastTouchDistance.current = dist;
      const cx = (t[0].pageX + t[1].pageX) / 2;
      const cy = (t[0].pageY + t[1].pageY) / 2;
      pinchStart.current = { zoom, center: { x: cx, y: cy }, offset: viewOffset };
      setIsDragging(false);
      return;
    }
    if (t.length === 1) {
      setIsDragging(true);
      dragStart.current = { x: t[0].pageX - viewOffset.x, y: t[0].pageY - viewOffset.y };
    }
  };

  const onTouchMove = (e: any) => {
    const t = e.nativeEvent.touches;
    if (t.length === 2 && lastTouchDistance.current && pinchStart.current) {
      const dist = getTouchDistance(t);
      const delta = (dist - lastTouchDistance.current) * 0.004;
      const newZoom = clamp(pinchStart.current.zoom + delta, 0.6, 2.2);

      const cx = (t[0].pageX + t[1].pageX) / 2;
      const cy = (t[0].pageY + t[1].pageY) / 2;

      // zoom “ancorato” al centro pinch
      const ratio = newZoom / zoom;
      const newOffsetX = cx - (cx - viewOffset.x) * ratio;
      const newOffsetY = cy - (cy - viewOffset.y) * ratio;

      setZoom(newZoom);
      setViewOffset({ x: newOffsetX, y: newOffsetY });
      lastTouchDistance.current = dist;
      return;
    }

    if (t.length === 1 && isDragging) {
      setViewOffset({ x: t[0].pageX - dragStart.current.x, y: t[0].pageY - dragStart.current.y });
    }
  };

  const onTouchEnd = (e: any) => {
    const t = e.nativeEvent.touches;
    if (!t || t.length === 0) setIsDragging(false);
    if (!t || t.length < 2) {
      lastTouchDistance.current = null;
      pinchStart.current = null;
    }
  };

  // UI actions
  const handleCallKing = async () => {
    setKingGoingToCastle(true);
    setSelectedBuilding(null);
    setSelectedRiver(null);
    setSelectedCharacter(null);
    await Haptics.selectionAsync();
  };

  const handleCallFarmer = async () => {
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

  // Limiti offset (evita “perdersi” troppo)
  useEffect(() => {
    const { width, height } = Dimensions.get("window");
    const gridW = gridPixelSize.w * zoom;
    const gridH = gridPixelSize.h * zoom;
    const maxLeft = 30;
    const maxTop = 80;
    const minLeft = Math.min(maxLeft, width - gridW - 30);
    const minTop = Math.min(maxTop, height - gridH - 160);
    setViewOffset((o) => ({ x: clamp(o.x, minLeft, maxLeft), y: clamp(o.y, minTop, maxTop) }));
  }, [zoom, gridPixelSize.h, gridPixelSize.w]);

  const openCharacter = async (char: Character) => {
    if (isDragging) return;
    setSelectedCharacter(char);
    setSelectedBuilding(null);
    setSelectedRiver(null);
    await Haptics.selectionAsync();
  };

  const openBuilding = async (b: Building) => {
    if (isDragging) return;
    setSelectedBuilding(b);
    setSelectedCharacter(null);
    setSelectedRiver(null);
    await Haptics.selectionAsync();
  };

  const selectRiver = async (x: number, y: number) => {
    if (isDragging) return;
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

  const closeModal = () => {
    setSelectedCharacter(null);
    setSelectedBuilding(null);
    setSelectedRiver(null);
  };

  // Render
  const gridCells = useMemo(() => {
    const cells: React.ReactNode[] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const river = isRiver(x, y);
        const bridge = isBridge(x, y);
        const castle = isInsideBuilding(castleData, x, y);
        const farm = isInsideBuilding(farmData, x, y);
        const sea = isSea(x, y);
        const beach = isBeach(x, y);
        const tree = isTree(x, y);
        const mine = isMine(x, y);

        let bg = "#2f9e44";
        if (sea) bg = "#1c7ed6";
        else if (beach) bg = "#ffd43b";
        else if (river && !bridge) bg = "#4dabf7";
        else if (bridge) bg = "#8d5a2b";
        else if (castle) bg = "#495057";
        else if (farm) bg = "#b08900";

        const emoji =
          sea ? "🌊" : beach ? "🏖️" : river && !bridge ? "💧" : bridge ? "🌉" : tree ? "🌲" : mine ? "⛏️" : "🌱";

        const emojiOpacity = sea || beach || river || bridge || tree || mine ? 1 : 0.25;
        const emojiSize = tree || mine ? 22 : 16;

        cells.push(
          <Pressable
            key={`${x}-${y}`}
            onPress={() => (river && !bridge ? selectRiver(x, y) : undefined)}
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
            <Text style={{ fontSize: emojiSize, opacity: emojiOpacity }}>{emoji}</Text>
          </Pressable>
        );
      }
    }
    return cells;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridges, trees, mines, selectedRiver, zoom, viewOffset, isDragging]);

  const characterNodes = useMemo(() => {
    return characters.map((c) => {
      const left = c.x * (CELL_SIZE + CELL_GAP) + CELL_SIZE * 0.1;
      const top = c.y * (CELL_SIZE + CELL_GAP) + CELL_SIZE * 0.05;
      return (
        <Pressable
          key={`char-${c.id}`}
          onPress={() => openCharacter(c)}
          style={[
            styles.char,
            {
              left,
              top,
              width: CELL_SIZE,
              height: CELL_SIZE
            }
          ]}
        >
          <Text style={{ fontSize: 24 }}>{c.emoji}</Text>
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
        <Pressable
          key={`building-${b.type}`}
          onPress={() => openBuilding(b)}
          style={[
            styles.building,
            {
              left: centerX,
              top: centerY
            }
          ]}
        >
          <Text style={{ fontSize: 38 }}>{b.emoji}</Text>
        </Pressable>
      );
    };
    add(castleData);
    add(farmData);
    return nodes;
  }, [isDragging]);

  const transformStyle = useMemo(
    () => ({
      transform: [{ translateX: viewOffset.x }, { translateY: viewOffset.y }, { scale: zoom }]
    }),
    [viewOffset.x, viewOffset.y, zoom]
  );

  return (
    <View style={styles.root}>
      <View
        style={styles.stage}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onTouchStart}
        onResponderMove={onTouchMove}
        onResponderRelease={onTouchEnd}
        onResponderTerminate={onTouchEnd}
      >
        <View style={[styles.world, transformStyle]}>
          <View style={[styles.grid, { width: gridPixelSize.w, height: gridPixelSize.h }]}>{gridCells}</View>
          <View pointerEvents="box-none" style={[StyleSheet.absoluteFill]} />
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            {buildingNodes}
            {characterNodes}
          </View>
        </View>
      </View>

      {/* HUD */}
      <View style={styles.hud}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hudRow}>
          <Pressable style={styles.btn} onPress={reset}>
            <Text style={styles.btnText}>↻ Reset</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={handleZoomOut}>
            <Text style={styles.btnText}>− Zoom</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={handleZoomIn}>
            <Text style={styles.btnText}>＋ Zoom</Text>
          </Pressable>
          <Pressable style={styles.btnPrimary} onPress={handleCallKing}>
            <Text style={styles.btnTextPrimary}>Chiama Re</Text>
          </Pressable>
          <Pressable style={styles.btnPrimary} onPress={handleCallFarmer}>
            <Text style={styles.btnTextPrimary}>Chiama Contadino</Text>
          </Pressable>
          {selectedRiver && (
            <Pressable style={styles.btnWarn} onPress={buildBridge}>
              <Text style={styles.btnTextPrimary}>Costruisci ponte</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>

      {/* Modale info */}
      <Modal visible={!!(selectedCharacter || selectedBuilding || selectedRiver)} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeModal}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
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
                  <Text style={styles.modalHint}>Suggerimento: premi “Chiama Re” per farlo entrare nel castello.</Text>
                )}
                {selectedBuilding.type === "farm" && (
                  <Text style={styles.modalHint}>Suggerimento: premi “Chiama Contadino” per farlo andare al campo.</Text>
                )}
              </>
            )}
            {selectedRiver && (
              <>
                <Text style={styles.modalTitle}>💧 Fiume</Text>
                <Text style={styles.modalSub}>
                  Casella: ({selectedRiver.x}, {selectedRiver.y})
                </Text>
                <Text style={styles.modalHint}>Puoi costruire un ponte per far attraversare i personaggi.</Text>
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
  root: {
    flex: 1,
    backgroundColor: "#0b3d1f"
  },
  stage: {
    flex: 1,
    backgroundColor: "#1b5e20"
  },
  world: {
    position: "absolute",
    left: 0,
    top: 0
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: CELL_GAP / 2
  },
  cell: {
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  char: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center"
  },
  building: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center"
  },
  hud: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "rgba(0,0,0,0.25)"
  },
  hudRow: {
    gap: 10,
    alignItems: "center"
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)"
  },
  btnPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#2f9e44"
  },
  btnWarn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#f59f00"
  },
  btnText: {
    color: "white",
    fontWeight: "700"
  },
  btnTextPrimary: {
    color: "#08210f",
    fontWeight: "900"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    backgroundColor: "#0f2b18",
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)"
  },
  modalTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8
  },
  modalSub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    marginBottom: 6
  },
  modalHint: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    marginTop: 8
  }
});

