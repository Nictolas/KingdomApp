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

  // Calcola il minZoom dinamico per impedire di vedere oltre la griglia
  const getDynamicMinZoom = () => {
    const { width, height } = Dimensions.get("window");
    const minZoomForWidth = width / gridWidth;
    const minZoomForHeight = height / gridHeight;
    return Math.max(minZoom, minZoomForWidth, minZoomForHeight);
  };

  // Clamp dell'offset per impedire di vedere oltre la griglia
  // IMPORTANTE: con scale -> translate, il translate è nel sistema NON scalato
  // Modello: screen = world * zoom + offset
  // Quindi offset è nel sistema NON scalato
  const clampOffset = (o: Point, z: number): Point => {
    const { width, height } = Dimensions.get("window");
    const scaledGridW = gridWidth * z;
    const scaledGridH = gridHeight * z;

    // Se la griglia scalata è più piccola della finestra: centra e blocca
    if (scaledGridW <= width && scaledGridH <= height) {
      const centerX = (width - scaledGridW) / 2;
      const centerY = (height - scaledGridH) / 2;
      return { x: centerX, y: centerY };
    }

    // Se la griglia è più grande: limita l'offset per mantenerla dentro
    // offset è nel sistema NON scalato, quindi i limiti devono essere nel sistema NON scalato
    // Limiti nel sistema NON scalato:
    // - offset.x può essere negativo fino a quando la griglia scalata non esce a destra
    // - offset.x può essere positivo fino a quando la griglia scalata non esce a sinistra
    // Con screen = world * zoom + offset:
    // - Se offset.x = 0, la griglia inizia a screen = 0
    // - Se offset.x = width - scaledGridW, la griglia finisce a screen = width
    const minX = width - scaledGridW; // La griglia finisce a destra quando offset = width - scaledGridW
    const maxX = 0; // La griglia inizia a sinistra quando offset = 0
    const minY = height - scaledGridH;
    const maxY = 0;

    return {
      x: clamp(o.x, minX, maxX),
      y: clamp(o.y, minY, maxY)
    };
  };

  // Zoom verso un punto specifico dello schermo
  const zoomToPoint = (screenX: number, screenY: number, newZoom: number) => {
    const dynamicMinZoom = getDynamicMinZoom();
    const clampedZoom = clamp(newZoom, dynamicMinZoom, maxZoom);

    // Modello camera: screen = world * zoom + offset
    // Con scale -> translate, il translate è nel sistema NON scalato
    // Quindi: world = (screen - offset) / zoom
    const worldX = (screenX - offset.x) / zoom;
    const worldY = (screenY - offset.y) / zoom;

    // Nuovo offset per mantenere lo stesso punto del mondo sotto il cursore
    // screen = world * newZoom + newOffset
    // newOffset = screen - world * newZoom
    const newOffsetX = screenX - worldX * clampedZoom;
    const newOffsetY = screenY - worldY * clampedZoom;

    const clampedOffset = clampOffset({ x: newOffsetX, y: newOffsetY }, clampedZoom);
    setZoom(clampedZoom);
    setOffset(clampedOffset);
  };

  // Pan (sposta la camera)
  const pan = (dx: number, dy: number) => {
    const newOffset = { x: offset.x + dx, y: offset.y + dy };
    setOffset(clampOffset(newOffset, zoom));
  };

  // Zoom incrementale verso un punto
  const zoomIncrement = (screenX: number, screenY: number, delta: number) => {
    const dynamicMinZoom = getDynamicMinZoom();
    // Clamp il nuovo zoom PRIMA di calcolare il nuovo offset
    const newZoom = clamp(zoom + delta, dynamicMinZoom, maxZoom);
    // Se il nuovo zoom è uguale al vecchio (perché è stato clampato), non fare nulla
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
    // Le coordinate sono relative al container stage
    // Su React Native Web, clientX/clientY sono relativi alla finestra
    // Ma il container stage riempie tutto lo schermo (flex: 1), quindi possiamo usare direttamente clientX/clientY
    // Tuttavia, dobbiamo considerare che il container potrebbe avere padding/margin
    // Per sicurezza, usiamo le coordinate della finestra direttamente
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
      dragStartRef.current = { x: t[0].pageX - offset.x, y: t[0].pageY - offset.y };
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
      const dx = t[0].pageX - dragStartRef.current.x - offset.x;
      const dy = t[0].pageY - dragStartRef.current.y - offset.y;
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
    dragStartRef.current = { x: x - offset.x, y: y - offset.y };
  };

  const handleMouseMove = (e: any) => {
    if (typeof window === "undefined") return;
    if (!isDraggingRef.current) return;
    const ne = e?.nativeEvent;
    const x = ne?.clientX ?? 0;
    const y = ne?.clientY ?? 0;
    const dx = x - dragStartRef.current.x - offset.x;
    const dy = y - dragStartRef.current.y - offset.y;
    pan(dx, dy);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Clamp offset quando cambia zoom o dimensioni griglia
  // IMPORTANTE: questo useEffect garantisce che l'offset sia sempre clampato
  useEffect(() => {
    setOffset((o) => clampOffset(o, zoom));
  }, [zoom, gridWidth, gridHeight]);
  
  // Clamp anche quando cambiano le dimensioni della finestra
  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", () => {
      setOffset((o) => clampOffset(o, zoom));
    });
    return () => subscription?.remove();
  }, [zoom, gridWidth, gridHeight]);

  // Transform style per React Native
  // IMPORTANTE: ordine = scale -> translate
  // Con questo ordine, il translate è nel sistema NON scalato
  const transformStyle = useMemo(
    () => ({ transform: [{ scale: zoom }, { translateX: offset.x }, { translateY: offset.y }] }),
    [offset.x, offset.y, zoom]
  );

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
