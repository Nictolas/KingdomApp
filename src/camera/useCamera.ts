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
  gridStyle: { width: number; height: number; transform: any[] };
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
  // Calcola lo zoom iniziale dinamico - inizializza con un valore temporaneo
  const getInitialZoom = () => {
    try {
      const { width, height } = Dimensions.get("window");
      const minZoomForWidth = width / gridWidth;
      const minZoomForHeight = height / gridHeight;
      return Math.max(minZoomForWidth, minZoomForHeight);
    } catch {
      // Fallback se Dimensions non è disponibile
      return minZoom;
    }
  };
  const [zoom, setZoom] = useState(() => getInitialZoom());
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });
  
  // Ref per accedere ai valori più recenti - inizializzati con i valori iniziali
  const offsetRef = useRef<Point>({ x: 0, y: 0 });
  const zoomRef = useRef<number>(getInitialZoom());
  
  // Sincronizza i ref con lo stato
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);
  
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // REGOLA 1: Lo zoom non deve esserci
  // Calcola il fattore di scala necessario per coprire lo schermo
  // Questo NON è zoom - è solo un calcolo per dimensionare la griglia
  const getScaleFactor = () => {
    const { width, height } = Dimensions.get("window");
    // Calcola il fattore necessario per coprire lo schermo in larghezza e altezza
    const scaleForWidth = width / gridWidth;
    const scaleForHeight = height / gridHeight;
    // Usa il massimo tra i due per coprire tutta la finestra
    // Aggiungi un margine (5%) per garantire che copra completamente senza spazi neri
    const calculatedScale = Math.max(scaleForWidth, scaleForHeight) * 1.05;
    return calculatedScale;
  };

  // APPROCCIO DIRETTO: offset è la posizione dell'angolo in alto a sinistra della griglia nello schermo
  // Le dimensioni scalate sono gridWidth*zoom x gridHeight*zoom
  // Con left/top/width/height: left=offset.x, top=offset.y, width=gridWidth*zoom, height=gridHeight*zoom
  const clampOffset = (o: Point, z: number): Point => {
    const { width, height } = Dimensions.get("window");
    const scaledGridW = gridWidth * z;
    const scaledGridH = gridHeight * z;

    // Limita l'offset per mantenere la griglia dentro i bordi dello schermo
    // offset è la posizione dell'angolo in alto a sinistra della griglia
    // La griglia va da offset.x a offset.x + scaledGridW
    // 
    // Se la griglia è più grande dello schermo:
    // - Non vedere oltre a sinistra: offset.x <= 0
    // - Non vedere oltre a destra: offset.x + scaledGridW >= width, quindi offset.x >= width - scaledGridW
    // - Non vedere oltre in alto: offset.y <= 0
    // - Non vedere oltre in basso: offset.y + scaledGridH >= height, quindi offset.y >= height - scaledGridH
    //
    // Se la griglia è più piccola dello schermo, centrarla (ma questo non dovrebbe mai succedere con lo zoom minimo dinamico)
    
    const minX = width - scaledGridW; // offset minimo per non vedere oltre a destra
    const maxX = 0; // offset massimo per non vedere oltre a sinistra
    const minY = height - scaledGridH; // offset minimo per non vedere oltre in basso
    const maxY = 0; // offset massimo per non vedere oltre in alto

    return {
      x: clamp(o.x, minX, maxX),
      y: clamp(o.y, minY, maxY)
    };
  };

  // Zoom verso un punto specifico - RIMOSSO COMPLETAMENTE
  const zoomToPoint = () => {
    // Zoom completamente rimosso
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

  // Zoom incrementale - RIMOSSO COMPLETAMENTE
  const zoomIncrement = () => {
    // Zoom completamente rimosso
    return;
  };

  // Zoom con rotellina del mouse - RIMOSSO COMPLETAMENTE
  const handleWheel = () => {
    // Zoom completamente rimosso
    return;
  };

  // Touch handlers - getTouchDistance rimosso (non serve più senza pinch-to-zoom)

  const onTouchStart = (e: any) => {
    const t = e.nativeEvent.touches;
    // Pinch-to-zoom completamente rimosso - ignora 2 dita
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


  // REGOLA 1: Lo zoom non deve esserci
  // REGOLA 2: La griglia e il mondo sono la stessa cosa
  // REGOLA 3: Non deve esistere nulla oltre il mondo griglia
  // Imposta la scala fissa al mount e quando cambiano le dimensioni della griglia o finestra
  useEffect(() => {
    const fixedScale = getScaleFactor();
    setZoom(fixedScale);
    zoomRef.current = fixedScale;
    // Offset iniziale: sempre (0,0) per garantire che la griglia copra tutto lo schermo
    // Il mondo E la griglia sono la stessa cosa - tutto lo schermo è la griglia
    const initialOffset = clampOffset({ x: 0, y: 0 }, fixedScale);
    setOffset(initialOffset);
    offsetRef.current = initialOffset;
  }, [gridWidth, gridHeight]);
  
  // Ricalcola la scala fissa quando cambiano le dimensioni della finestra
  // REGOLA 1: Lo zoom non deve esserci - solo ricalcolo della scala per coprire lo schermo
  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", () => {
      const fixedScale = getScaleFactor();
      setZoom(fixedScale);
      zoomRef.current = fixedScale;
      // Mantieni l'offset corrente ma clampalo ai nuovi limiti
      const clampedOffset = clampOffset(offset, fixedScale);
      setOffset(clampedOffset);
      offsetRef.current = clampedOffset;
    });
    return () => subscription?.remove();
  }, [gridWidth, gridHeight, offset]);

  // REGOLA 1: Lo zoom non deve esserci - la griglia viene scalata solo per coprire lo schermo
  // REGOLA 2: La griglia e il mondo sono la stessa cosa - tutto lo schermo è la griglia
  // REGOLA 3: Non deve esistere nulla oltre il mondo griglia
  
  // Il contenitore world è SEMPRE grande quanto lo schermo
  // Il mondo E la griglia sono la stessa cosa - tutto lo schermo è la griglia
  const worldStyle = useMemo(() => {
    const { width, height } = Dimensions.get("window");
    const style = {
      position: "absolute" as const,
      left: 0,
      top: 0,
      width: width,
      height: height,
      overflow: "hidden" as const
    };
    return style;
  }, []);
  
  // La griglia viene scalata per coprire sempre tutto lo schermo
  // NON usiamo transform: scale perché lo zoom non deve esistere
  // Invece calcoliamo direttamente le dimensioni scalate e la posizione
  const gridStyle = useMemo(() => {
    const { width, height } = Dimensions.get("window");
    // Calcola il fattore di scala necessario per coprire lo schermo
    const scaleX = width / gridWidth;
    const scaleY = height / gridHeight;
    const scale = Math.max(scaleX, scaleY); // Usa il massimo per coprire tutto
    
    // Calcola le dimensioni scalate
    const scaledWidth = gridWidth * scale;
    const scaledHeight = gridHeight * scale;
    
    // Calcola la posizione per centrare se necessario, o per coprire tutto lo schermo
    let left = offset.x;
    let top = offset.y;
    
    // Se la griglia scalata è più piccola dello schermo, centrarla
    if (scaledWidth < width) {
      left = (width - scaledWidth) / 2;
    }
    if (scaledHeight < height) {
      top = (height - scaledHeight) / 2;
    }
    
    return {
      width: scaledWidth,
      height: scaledHeight,
      transform: [
        { translateX: left },
        { translateY: top }
      ]
    };
  }, [gridWidth, gridHeight, offset.x, offset.y]);
  
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
