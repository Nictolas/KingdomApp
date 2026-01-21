import { useState, useRef } from "react";
import type { Point } from "../types";

type UseCameraOptions = {
  gridWidth: number;
  gridHeight: number;
};

export type Camera = {
  offset: Point;
  pan: (dx: number, dy: number) => void;
  onTouchStart: (e: any) => void;
  onTouchMove: (e: any) => void;
  onTouchEnd: () => void;
  handleMouseDown: (e: any) => void;
  handleMouseMove: (e: any) => void;
  handleMouseUp: () => void;
};

export function useCamera({ gridWidth, gridHeight }: UseCameraOptions): Camera {
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const offsetRef = useRef<Point>({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });

  // Sincronizza il ref con lo stato
  const updateOffset = (newOffset: Point) => {
    offsetRef.current = newOffset;
    setOffset(newOffset);
  };

  const pan = (dx: number, dy: number) => {
    const newOffset = {
      x: offsetRef.current.x + dx,
      y: offsetRef.current.y + dy
    };
    updateOffset(newOffset);
  };

  // Touch handlers
  const onTouchStart = (e: any) => {
    const t = e.nativeEvent.touches;
    if (t.length === 1) {
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: t[0].pageX,
        y: t[0].pageY
      };
    }
  };

  const onTouchMove = (e: any) => {
    const t = e.nativeEvent.touches;
    if (t.length === 1 && isDraggingRef.current) {
      e.preventDefault?.();
      const currentX = t[0].pageX;
      const currentY = t[0].pageY;
      const dx = currentX - dragStartRef.current.x;
      const dy = currentY - dragStartRef.current.y;
      
      // Aggiorna l'offset usando il ref per evitare problemi di closure
      const newOffset = {
        x: offsetRef.current.x + dx,
        y: offsetRef.current.y + dy
      };
      updateOffset(newOffset);
      
      // Aggiorna il punto di partenza per il prossimo movimento
      dragStartRef.current = { x: currentX, y: currentY };
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
    dragStartRef.current = {
      x: x,
      y: y
    };
  };

  const handleMouseMove = (e: any) => {
    if (typeof window === "undefined" || !isDraggingRef.current) return;
    e.preventDefault?.();
    const ne = e?.nativeEvent;
    const currentX = ne?.clientX ?? 0;
    const currentY = ne?.clientY ?? 0;
    const dx = currentX - dragStartRef.current.x;
    const dy = currentY - dragStartRef.current.y;
    
    // Aggiorna l'offset usando il ref per evitare problemi di closure
    const newOffset = {
      x: offsetRef.current.x + dx,
      y: offsetRef.current.y + dy
    };
    updateOffset(newOffset);
    
    // Aggiorna il punto di partenza per il prossimo movimento
    dragStartRef.current = { x: currentX, y: currentY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  return {
    offset,
    pan,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
  };
}
