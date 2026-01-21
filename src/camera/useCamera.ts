import { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions } from "react-native";
import type { Point } from "../types";
import { clamp } from "../utils";

type UseCameraOptions = {
  gridWidth: number;
  gridHeight: number;
  minZoom?: number;
  maxZoom?: number;
};

export type Camera = {
  offset: Point;
  zoom: number;
  transformStyle: any;
  worldStyle: { left: number; top: number; width: number; height: number };
  gridStyle: { transform: any[] };
  isDragging: boolean;
  handleWheel: (e: any) => void;
  onTouchStart: (e: any) => void;
  onTouchMove: (e: any) => void;
  onTouchEnd: (e: any) => void;
  handleMouseDown: (e: any) => void;
  handleMouseMove: (e: any) => void;
  handleMouseUp: () => void;
  zoomToPoint: (screenX: number, screenY: number, newZoom: number) => void;
  zoomIncrement: (screenX: number, screenY: number, delta: number) => void;
  pan: (dx: number, dy: number) => void;
};

export function useCamera({ gridWidth, gridHeight, minZoom = 0.6, maxZoom = 2.2 }: UseCameraOptions): Camera {
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  // Zoom fisso al minimo (zoom indietro massima)
  const [zoom, setZoom] = useState(minZoom);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });
  const lastTouchDistanceRef = useRef<number | null>(null);
  
  // Ref per accedere ai valori più recenti - inizializzati con i valori iniziali
  const offsetRef = useRef<Point>({ x: 0, y: 0 });
  const zoomRef = useRef<number>(1);
  
  // Sincronizza i ref con lo stato
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);
  
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Calcola il minZoom dinamico: impedisce di vedere oltre la griglia
  // Il minZoom deve essere tale che la griglia scalata copra almeno tutta la finestra
  const getDynamicMinZoom = () => {
    const { width, height } = Dimensions.get("window");
    const minZoomForWidth = width / gridWidth;
    const minZoomForHeight = height / gridHeight;
    // Usa il massimo tra i due per coprire tutta la finestra
    const calculatedMinZoom = Math.max(minZoomForWidth, minZoomForHeight);
    // Non scendere sotto il minZoom base, ma permettere zoom indietro se necessario
    return Math.max(minZoom, calculatedMinZoom);
  };

  // APPROCCIO DIRETTO: offset è la posizione dell'angolo in alto a sinistra della griglia nello schermo
  // Le dimensioni scalate sono gridWidth*zoom x gridHeight*zoom
  // Con left/top/width/height: left=offset.x, top=offset.y, width=gridWidth*zoom, height=gridHeight*zoom
  const clampOffset = (o: Point, z: number): Point => {
    const { width, height } = Dimensions.get("window");
    const scaledGridW = gridWidth * z;
    const scaledGridH = gridHeight * z;

    // Se la griglia scalata è più piccola della finestra: CENTRA e BLOCCA
    if (scaledGridW <= width && scaledGridH <= height) {
      return {
        x: (width - scaledGridW) / 2,
        y: (height - scaledGridH) / 2
      };
    }

    // Se la griglia è più grande: limita l'offset per mantenerla dentro
    // offset è la posizione dell'angolo in alto a sinistra della griglia
    // La griglia va da offset.x a offset.x + scaledGridW
    // Per non vedere oltre a sinistra: offset.x <= 0
    // Per non vedere oltre a destra: offset.x + scaledGridW >= width, quindi offset.x >= width - scaledGridW
    // IMPORTANTE: minX e maxX devono essere nell'ordine corretto per clamp()
    // clamp(value, min, max) richiede min <= max
    const minX = Math.min(0, width - scaledGridW); // Il più piccolo tra 0 e width - scaledGridW
    const maxX = 0; // La griglia inizia a sinistra quando offset = 0
    const minY = Math.min(0, height - scaledGridH); // Il più piccolo tra 0 e height - scaledGridH
    const maxY = 0; // La griglia inizia in alto quando offset = 0

    // Assicuriamoci che minX <= maxX e minY <= maxY
    const finalMinX = Math.min(minX, maxX);
    const finalMaxX = Math.max(minX, maxX);
    const finalMinY = Math.min(minY, maxY);
    const finalMaxY = Math.max(minY, maxY);

    return {
      x: clamp(o.x, finalMinX, finalMaxX),
      y: clamp(o.y, finalMinY, finalMaxY)
    };
  };

  // Zoom verso un punto specifico dello schermo - DISABILITATO
  const zoomToPoint = (screenX: number, screenY: number, newZoom: number) => {
    // Zoom disabilitato - non fare nulla
    return;
  };

  // Pan (sposta la camera)
  // dx, dy sono in pixel schermo
  const pan = (dx: number, dy: number) => {
    const newOffset = { x: offset.x + dx, y: offset.y + dy };
    const clamped = clampOffset(newOffset, zoom);
    // Aggiorna il ref immediatamente
    offsetRef.current = clamped;
    setOffset(clamped);
  };

  // Zoom incrementale verso un punto
  const zoomIncrement = (screenX: number, screenY: number, delta: number) => {
    const dynamicMinZoom = getDynamicMinZoom();
    const currentZoom = zoomRef.current;
    const newZoom = clamp(currentZoom + delta, dynamicMinZoom, maxZoom);
    // Se lo zoom non cambia (clamp lo ha bloccato), non fare nulla
    if (Math.abs(newZoom - currentZoom) < 0.001) {
      console.log("Zoom blocked:", { currentZoom, newZoom, delta, dynamicMinZoom, maxZoom });
      return;
    }
    console.log("Zooming:", { currentZoom, newZoom, delta });
    // Usa zoomToPoint che gestisce correttamente tutto
    zoomToPoint(screenX, screenY, newZoom);
  };

  // Zoom con rotellina del mouse - DISABILITATO
  const handleWheel = (e: any) => {
    // Zoom disabilitato - non fare nulla
    return;
  };

  // Touch handlers
  const getTouchDistance = (touches: any) => {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = (e: any) => {
    const t = e.nativeEvent.touches;
    if (t.length === 2) {
      lastTouchDistanceRef.current = getTouchDistance(t);
      isDraggingRef.current = false;
      return;
    }
    if (t.length === 1) {
      isDraggingRef.current = true;
      // Calcoliamo il punto del mondo sotto il dito
      // screenX = worldX * zoom + offset.x
      // worldX = (screenX - offset.x) / zoom
      const worldX = (t[0].pageX - offset.x) / zoom;
      const worldY = (t[0].pageY - offset.y) / zoom;
      dragStartRef.current = { x: worldX, y: worldY };
    }
  };

  const onTouchMove = (e: any) => {
    const t = e.nativeEvent.touches;
    // Pinch-to-zoom disabilitato - ignora 2 dita
    if (t.length === 1 && isDraggingRef.current) {
      // Calcoliamo dove è ora il punto del mondo nello schermo
      // screenX = worldX * zoom + offset.x
      const currentScreenX = dragStartRef.current.x * zoom + offset.x;
      const currentScreenY = dragStartRef.current.y * zoom + offset.y;
      // La differenza è quanto dobbiamo spostare
      const dx = t[0].pageX - currentScreenX;
      const dy = t[0].pageY - currentScreenY;
      pan(dx, dy);
    }
  };

  const onTouchEnd = (e: any) => {
    const t = e.nativeEvent.touches;
    if (!t || t.length === 0) {
      isDraggingRef.current = false;
    }
    if (!t || t.length < 2) {
      lastTouchDistanceRef.current = null;
    }
  };

  // Mouse handlers
  const handleMouseDown = (e: any) => {
    if (typeof window === "undefined") return;
    const ne = e?.nativeEvent;
    const x = ne?.clientX ?? 0;
    const y = ne?.clientY ?? 0;
    isDraggingRef.current = true;
    // Calcoliamo il punto del mondo sotto il mouse
    // screenX = worldX * zoom + offset.x
    // worldX = (screenX - offset.x) / zoom
    const worldX = (x - offset.x) / zoom;
    const worldY = (y - offset.y) / zoom;
    dragStartRef.current = { x: worldX, y: worldY };
  };

  const handleMouseMove = (e: any) => {
    if (typeof window === "undefined") return;
    if (!isDraggingRef.current) return;
    const ne = e?.nativeEvent;
    const x = ne?.clientX ?? 0;
    const y = ne?.clientY ?? 0;
    // Calcoliamo dove è ora il punto del mondo nello schermo
    // screenX = worldX * zoom + offset.x
    const currentScreenX = dragStartRef.current.x * zoom + offset.x;
    const currentScreenY = dragStartRef.current.y * zoom + offset.y;
    // La differenza è quanto dobbiamo spostare
    const dx = x - currentScreenX;
    const dy = y - currentScreenY;
    pan(dx, dy);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Clamp offset quando cambiano le dimensioni della griglia
  useEffect(() => {
    setOffset((o) => clampOffset(o, zoom));
  }, [gridWidth, gridHeight]);
  
  // Clamp anche quando cambiano le dimensioni della finestra
  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", () => {
      setOffset((o) => clampOffset(o, zoom));
    });
    return () => subscription?.remove();
  }, [zoom, gridWidth, gridHeight]);

  // Imposta lo zoom iniziale al minZoom quando cambiano le dimensioni della griglia
  useEffect(() => {
    const dynamicMinZoom = getDynamicMinZoom();
    setZoom(dynamicMinZoom);
    zoomRef.current = dynamicMinZoom;
  }, [gridWidth, gridHeight]);

  // APPROCCIO: il contenitore world mantiene dimensioni fisse e posizione
  // Il contenuto interno viene scalato con gridStyle
  const worldStyle = useMemo(() => {
    const style = {
      position: "absolute" as const,
      left: offset.x,
      top: offset.y,
      width: gridWidth,
      height: gridHeight
    };
    console.log("worldStyle recalculated:", { zoom, gridWidth, gridHeight, offset });
    return style;
  }, [offset.x, offset.y, zoom, gridWidth, gridHeight]);
  
  // Scaliamo il contenuto interno invece del contenitore
  const gridStyle = useMemo(() => {
    return {
      transform: [{ scale: zoom }]
    };
  }, [zoom]);
  
  // Manteniamo transformStyle per compatibilità, ma non lo usiamo più
  const transformStyle = useMemo(() => {
    return {
      transform: [
        { scale: zoom },
        { translateX: offset.x },
        { translateY: offset.y }
      ]
    };
  }, [offset.x, offset.y, zoom]);

  return {
    offset,
    zoom,
    transformStyle,
    worldStyle,
    gridStyle,
    isDragging: isDraggingRef.current,
    handleWheel,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    zoomToPoint,
    zoomIncrement,
    pan
  };
}
