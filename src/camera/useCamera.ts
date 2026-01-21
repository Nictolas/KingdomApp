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
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });

  const pan = (dx: number, dy: number) => {
    setOffset((prev) => ({
      x: prev.x + dx,
      y: prev.y + dy
    }));
  };

  // Touch handlers
  const onTouchStart = (e: any) => {
    const t = e.nativeEvent.touches;
    if (t.length === 1) {
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: t[0].pageX - offset.x,
        y: t[0].pageY - offset.y
      };
    }
  };

  const onTouchMove = (e: any) => {
    const t = e.nativeEvent.touches;
    if (t.length === 1 && isDraggingRef.current) {
      const dx = t[0].pageX - dragStartRef.current.x - offset.x;
      const dy = t[0].pageY - dragStartRef.current.y - offset.y;
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
    dragStartRef.current = {
      x: x - offset.x,
      y: y - offset.y
    };
  };

  const handleMouseMove = (e: any) => {
    if (typeof window === "undefined" || !isDraggingRef.current) return;
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
