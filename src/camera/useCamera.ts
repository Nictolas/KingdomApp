import { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions } from "react-native";
import type { Point } from "../types";
import { clamp } from "../utils";

type UseCameraOptions = {
  gridWidth: number;
  gridHeight: number;
};

export type Camera = {
  offset: Point;
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
  pan: (dx: number, dy: number) => void;
};

export function useCamera({ gridWidth, gridHeight }: UseCameraOptions): Camera {
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });
  const offsetRef = useRef<Point>({ x: 0, y: 0 });

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  // REGOLA 1: Lo zoom non deve esserci
  // REGOLA 2: La griglia e il mondo sono la stessa cosa
  // REGOLA 3: Non deve esistere nulla oltre il mondo griglia
  
  // Calcola il fattore di scala per coprire lo schermo
  const getScale = () => {
    const { width, height } = Dimensions.get("window");
    const scaleX = width / gridWidth;
    const scaleY = height / gridHeight;
    return Math.max(scaleX, scaleY) * 1.05; // Margine 5% per coprire tutto
  };

  // Limita l'offset per mantenere la griglia dentro lo schermo
  const clampOffset = (o: Point): Point => {
    const { width, height } = Dimensions.get("window");
    const scale = getScale();
    const scaledW = gridWidth * scale;
    const scaledH = gridHeight * scale;
    
    const minX = width - scaledW;
    const maxX = 0;
    const minY = height - scaledH;
    const maxY = 0;

    return {
      x: clamp(o.x, minX, maxX),
      y: clamp(o.y, minY, maxY)
    };
  };

  // Pan semplice
  const pan = (dx: number, dy: number) => {
    const newOffset = { x: offset.x + dx, y: offset.y + dy };
    const clamped = clampOffset(newOffset);
    offsetRef.current = clamped;
    setOffset(clamped);
  };

  // Touch handlers
  const onTouchStart = (e: any) => {
    const t = e.nativeEvent.touches;
    if (t.length === 1) {
      isDraggingRef.current = true;
      const scale = getScale();
      dragStartRef.current = {
        x: (t[0].pageX - offset.x) / scale,
        y: (t[0].pageY - offset.y) / scale
      };
    }
  };

  const onTouchMove = (e: any) => {
    const t = e.nativeEvent.touches;
    if (t.length === 1 && isDraggingRef.current) {
      const scale = getScale();
      const currentX = dragStartRef.current.x * scale + offset.x;
      const currentY = dragStartRef.current.y * scale + offset.y;
      const dx = t[0].pageX - currentX;
      const dy = t[0].pageY - currentY;
      pan(dx, dy);
    }
  };

  const onTouchEnd = () => {
    isDraggingRef.current = false;
  };

  // Mouse handlers
  const handleMouseDown = (e: any) => {
    if (typeof window === "undefined") return;
    const ne = e?.nativeEvent;
    const x = ne?.clientX ?? 0;
    const y = ne?.clientY ?? 0;
    isDraggingRef.current = true;
    const scale = getScale();
    dragStartRef.current = {
      x: (x - offset.x) / scale,
      y: (y - offset.y) / scale
    };
  };

  const handleMouseMove = (e: any) => {
    if (typeof window === "undefined" || !isDraggingRef.current) return;
    const ne = e?.nativeEvent;
    const x = ne?.clientX ?? 0;
    const y = ne?.clientY ?? 0;
    const scale = getScale();
    const currentX = dragStartRef.current.x * scale + offset.x;
    const currentY = dragStartRef.current.y * scale + offset.y;
    const dx = x - currentX;
    const dy = y - currentY;
    pan(dx, dy);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = () => {
    // Zoom rimosso
  };

  // Reset offset quando cambiano le dimensioni
  useEffect(() => {
    setOffset({ x: 0, y: 0 });
    offsetRef.current = { x: 0, y: 0 };
  }, [gridWidth, gridHeight]);

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", () => {
      const clamped = clampOffset(offset);
      setOffset(clamped);
      offsetRef.current = clamped;
    });
    return () => subscription?.remove();
  }, [offset]);

  // Il mondo è sempre grande quanto lo schermo
  const worldStyle = useMemo(() => {
    const { width, height } = Dimensions.get("window");
    return {
      position: "absolute" as const,
      left: 0,
      top: 0,
      width: width,
      height: height,
      overflow: "hidden" as const
    };
  }, []);

  // La griglia viene scalata per coprire lo schermo
  const gridStyle = useMemo(() => {
    const { width, height } = Dimensions.get("window");
    const scale = getScale();
    return {
      width: gridWidth * scale,
      height: gridHeight * scale,
      transform: [
        { translateX: offset.x },
        { translateY: offset.y }
      ]
    };
  }, [gridWidth, gridHeight, offset.x, offset.y]);

  return {
    offset,
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
    pan
  };
}
