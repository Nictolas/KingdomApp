import React, { useCallback, useEffect, useState } from "react";
import { Dimensions, Modal, Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useTutorialSpotlight } from "./TutorialSpotlightContext";
import type { SpotlightRect } from "./spotlightTypes";

function circlePath(cx: number, cy: number, r: number): string {
  return `M${cx} ${cy - r}A${r} ${r} 0 1 0 ${cx} ${cy + r}A${r} ${r} 0 1 0 ${cx} ${cy - r}Z`;
}

function isInsideCircle(x: number, y: number, cx: number, cy: number, r: number): boolean {
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/**
 * Overlay nero opaco con buco circolare ancorato al target registrato.
 * Usa Modal per stare sopra altri Modal (es. menu Costruisci).
 */
export function TutorialSpotlightOverlay() {
  const { active, getTarget } = useTutorialSpotlight();
  const [windowSize, setWindowSize] = useState(() => Dimensions.get("window"));
  const [hole, setHole] = useState<{ cx: number; cy: number; r: number } | null>(null);

  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) => {
      setWindowSize(window);
    });
    return () => sub.remove();
  }, []);

  const measureActive = useCallback(() => {
    if (!active) {
      setHole(null);
      return;
    }
    const entry = getTarget(active.targetId);
    entry?.ensureVisible?.();

    const applyRect = (rect: SpotlightRect) => {
      const cx = rect.x + rect.width / 2;
      const cy = rect.y + rect.height / 2;
      const r =
        active.radius ?? Math.max(rect.width, rect.height) / 2 + (active.padding ?? 8);
      setHole({ cx, cy, r: Math.max(12, r) });
    };

    const node = entry?.getNode() ?? null;
    if (node && typeof node.measureInWindow === "function") {
      node.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) {
          applyRect({ x, y, width, height });
          return;
        }
        if (active.fallbackRect) applyRect(active.fallbackRect);
        else setHole(null);
      });
      return;
    }
    if (active.fallbackRect) applyRect(active.fallbackRect);
    else setHole(null);
  }, [active, getTarget]);

  useEffect(() => {
    if (!active) {
      setHole(null);
      return;
    }
    measureActive();
    const t1 = setTimeout(measureActive, 50);
    const t2 = setTimeout(measureActive, 200);
    const t3 = setTimeout(measureActive, 500);
    const t4 = setTimeout(measureActive, 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [active, measureActive, windowSize.width, windowSize.height]);

  const { width, height } = windowSize;
  const visible = active != null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.root} accessibilityViewIsModal>
        {hole ? (
          <>
            <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Path
                d={`M0 0H${width}V${height}H0Z ${circlePath(hole.cx, hole.cy, hole.r)}`}
                fill="rgba(0, 0, 0, 0.82)"
                fillRule="evenodd"
              />
            </Svg>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={(e) => {
                if (!active) return;
                const { pageX, pageY } = e.nativeEvent;
                if (!isInsideCircle(pageX, pageY, hole.cx, hole.cy, hole.r)) return;
                getTarget(active.targetId)?.onPress?.();
              }}
            />
          </>
        ) : (
          <View style={styles.waiting} />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  waiting: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.82)"
  }
});
