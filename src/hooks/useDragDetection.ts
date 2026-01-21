import { useRef } from "react";

type UseDragDetectionReturn = {
  dragInfoRef: React.MutableRefObject<{ startX: number; startY: number; didDrag: boolean }>;
  lastDragAtRef: React.MutableRefObject<number>;
  wasRecentlyDragging: (isDragging: boolean) => boolean;
  handleTouchStart: (e: any, onTouchStart: (e: any) => void) => void;
  handleTouchMove: (e: any, isDragging: boolean, onTouchMove: (e: any) => void) => void;
  handleTouchEnd: (e: any, onTouchEnd: (e: any) => void) => void;
  handleMouseDown: (e: any, onMouseDown: (e: any) => void) => void;
  handleMouseMove: (e: any, isDragging: boolean, onMouseMove: (e: any) => void) => void;
  handleMouseUp: (onMouseUp: () => void) => void;
};

export function useDragDetection(): UseDragDetectionReturn {
  const dragInfoRef = useRef<{ startX: number; startY: number; didDrag: boolean }>({ startX: 0, startY: 0, didDrag: false });
  const lastDragAtRef = useRef<number>(0);

  const wasRecentlyDragging = (isDragging: boolean) => {
    if (isDragging) return true;
    if (dragInfoRef.current.didDrag) return true;
    return Date.now() - lastDragAtRef.current < 180;
  };

  const handleTouchStart = (e: any, onTouchStart: (e: any) => void) => {
    const t = e.nativeEvent.touches;
    if (t.length === 1) {
      dragInfoRef.current = { startX: t[0].pageX, startY: t[0].pageY, didDrag: false };
    }
    onTouchStart(e);
  };

  const handleTouchMove = (e: any, isDragging: boolean, onTouchMove: (e: any) => void) => {
    const t = e.nativeEvent.touches;
    if (t.length === 1 && isDragging) {
      const dx = t[0].pageX - dragInfoRef.current.startX;
      const dy = t[0].pageY - dragInfoRef.current.startY;
      if (!dragInfoRef.current.didDrag && Math.hypot(dx, dy) > 6) dragInfoRef.current.didDrag = true;
    }
    onTouchMove(e);
  };

  const handleTouchEnd = (e: any, onTouchEnd: (e: any) => void) => {
    onTouchEnd(e);
    if (dragInfoRef.current.didDrag) lastDragAtRef.current = Date.now();
  };

  const handleMouseDown = (e: any, onMouseDown: (e: any) => void) => {
    if (typeof window === "undefined") return;
    const ne = e?.nativeEvent;
    if (ne) {
      dragInfoRef.current = { startX: ne.clientX ?? 0, startY: ne.clientY ?? 0, didDrag: false };
    }
    onMouseDown(e);
  };

  const handleMouseMove = (e: any, isDragging: boolean, onMouseMove: (e: any) => void) => {
    if (isDragging) {
      const ne = e?.nativeEvent;
      if (ne) {
        const dx = ne.clientX - dragInfoRef.current.startX;
        const dy = ne.clientY - dragInfoRef.current.startY;
        if (!dragInfoRef.current.didDrag && Math.hypot(dx, dy) > 6) dragInfoRef.current.didDrag = true;
      }
    }
    onMouseMove(e);
  };

  const handleMouseUp = (onMouseUp: () => void) => {
    onMouseUp();
    if (dragInfoRef.current.didDrag) lastDragAtRef.current = Date.now();
  };

  return {
    dragInfoRef,
    lastDragAtRef,
    wasRecentlyDragging,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
  };
}
