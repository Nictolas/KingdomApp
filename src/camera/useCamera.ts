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

export function useCamera({ gridWidth, gridHeight, minZoom = 0.6, maxZoom = 2.2 }: UseCameraOptions) {
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });
  const lastTouchDistanceRef = useRef<number | null>(null);

  // Calcola il minZoom dinamico: impedisce di vedere oltre la griglia
  const getDynamicMinZoom = () => {
    const { width, height } = Dimensions.get("window");
    const minZoomForWidth = width / gridWidth;
    const minZoomForHeight = height / gridHeight;
    return Math.max(minZoom, minZoomForWidth, minZoomForHeight);
  };

  // APPROCCIO DIRETTO: offset è la posizione dell'angolo in alto a sinistra della griglia nello schermo
  // Le dimensioni scalate sono gridWidth*zoom x gridHeight*zoom
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
    // offset.x è la posizione X dell'angolo in alto a sinistra della griglia
    // Se offset.x = 0, la griglia inizia a sinistra (angolo in alto a sinistra a x=0)
    // Se offset.x = width - scaledGridW, la griglia finisce a destra (angolo in alto a sinistra spostato a sinistra)
    const minX = width - scaledGridW; // La griglia finisce a destra
    const maxX = 0; // La griglia inizia a sinistra
    const minY = height - scaledGridH; // La griglia finisce in basso
    const maxY = 0; // La griglia inizia in alto

    return {
      x: clamp(o.x, minX, maxX),
      y: clamp(o.y, minY, maxY)
    };
  };

  // Zoom verso un punto specifico dello schermo
  // Con scale -> translate in React Native, il modello è:
  // screen = world * zoom + offset
  // Dove offset è applicato DOPO lo scale
  const zoomToPoint = (screenX: number, screenY: number, newZoom: number) => {
    const dynamicMinZoom = getDynamicMinZoom();
    const clampedZoom = clamp(newZoom, dynamicMinZoom, maxZoom);

    // Calcoliamo quale punto del mondo è sotto il cursore PRIMA dello zoom
    // screen = world * zoom + offset
    // world = (screen - offset) / zoom
    const worldX = (screenX - offset.x) / zoom;
    const worldY = (screenY - offset.y) / zoom;

    // Calcoliamo il nuovo offset per mantenere lo stesso punto del mondo sotto il cursore
    // screen = world * newZoom + newOffset
    // newOffset = screen - world * newZoom
    const newOffsetX = screenX - worldX * clampedZoom;
    const newOffsetY = screenY - worldY * clampedZoom;

    const clampedOffset = clampOffset({ x: newOffsetX, y: newOffsetY }, clampedZoom);
    setZoom(clampedZoom);
    setOffset(clampedOffset);
  };

  // Pan (sposta la camera)
  // dx, dy sono in pixel schermo
  const pan = (dx: number, dy: number) => {
    const newOffset = { x: offset.x + dx, y: offset.y + dy };
    setOffset(clampOffset(newOffset, zoom));
  };

  // Zoom incrementale verso un punto
  const zoomIncrement = (screenX: number, screenY: number, delta: number) => {
    const dynamicMinZoom = getDynamicMinZoom();
    const newZoom = clamp(zoom + delta, dynamicMinZoom, maxZoom);
    if (Math.abs(newZoom - zoom) < 0.001) return;
    zoomToPoint(screenX, screenY, newZoom);
  };

  // Zoom con rotellina del mouse
  const handleWheel = (e: any) => {
    if (typeof window === "undefined") return;
    const ne = e.nativeEvent;
    if (!ne || typeof ne.deltaY === "undefined") return;
    e.preventDefault();

    const delta = ne.deltaY > 0 ? -0.1 : 0.1;
    const mouseX = ne.clientX ?? 0;
    const mouseY = ne.clientY ?? 0;
    zoomIncrement(mouseX, mouseY, delta);
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
      // screen = world * zoom + offset
      // world = (screen - offset) / zoom
      const worldX = (t[0].pageX - offset.x) / zoom;
      const worldY = (t[0].pageY - offset.y) / zoom;
      dragStartRef.current = { x: worldX, y: worldY };
    }
  };

  const onTouchMove = (e: any) => {
    const t = e.nativeEvent.touches;
    if (t.length === 2 && lastTouchDistanceRef.current) {
      const dist = getTouchDistance(t);
      const delta = (dist - lastTouchDistanceRef.current) * 0.004;
      const centerX = (t[0].pageX + t[1].pageX) / 2;
      const centerY = (t[0].pageY + t[1].pageY) / 2;
      zoomIncrement(centerX, centerY, delta);
      lastTouchDistanceRef.current = dist;
      return;
    }
    if (t.length === 1 && isDraggingRef.current) {
      // Calcoliamo dove è ora il punto del mondo nello schermo
      // screen = world * zoom + offset
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
    // screen = world * zoom + offset
    // world = (screen - offset) / zoom
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
    // screen = world * zoom + offset
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

  // Clamp offset quando cambia zoom o dimensioni griglia
  // IMPORTANTE: questo deve essere chiamato SEMPRE dopo ogni modifica
  useEffect(() => {
    const clamped = clampOffset(offset, zoom);
    // Solo aggiorna se è cambiato (evita loop infiniti)
    if (Math.abs(clamped.x - offset.x) > 0.01 || Math.abs(clamped.y - offset.y) > 0.01) {
      setOffset(clamped);
    }
  }, [zoom, gridWidth, gridHeight]);
  
  // Clamp anche quando cambiano le dimensioni della finestra
  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", () => {
      const clamped = clampOffset(offset, zoom);
      setOffset(clamped);
    });
    return () => subscription?.remove();
  }, [zoom, gridWidth, gridHeight, offset.x, offset.y]);

  // Transform style per React Native
  // Con scale -> translate: prima scala, poi trasla
  // Il translate viene applicato DOPO lo scale, quindi è nel sistema SCALATO
  // Ma noi vogliamo che offset sia la posizione assoluta nello schermo
  // Quindi: offset è già la posizione finale nello schermo
  const transformStyle = useMemo(() => {
    // Con scale -> translate, se voglio che l'angolo in alto a sinistra sia a offset.x:
    // - Prima scala la griglia di zoom (l'origine resta a 0,0)
    // - Poi trasla di offset.x
    // Ma questo non funziona perché il translate è nel sistema scalato
    
    // Proviamo un approccio diverso: usiamo solo scale e calcoliamo left/top direttamente
    // Ma React Native non supporta left/top con transform scale facilmente
    
    // SOLUZIONE: usiamo scale -> translate, ma calcoliamo il translate corretto
    // Se voglio che l'angolo in alto a sinistra della griglia sia a offset.x dopo lo scale:
    // - Dopo lo scale, la griglia è gridWidth*zoom x gridHeight*zoom
    // - L'origine è ancora a (0,0)
    // - Per spostare l'angolo a offset.x, devo traslare di offset.x
    
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
