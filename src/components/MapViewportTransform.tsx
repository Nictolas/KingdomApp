import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PanResponderGestureState,
  type StyleProp,
  type ViewStyle
} from "react-native";
import {
  centerNativeMap,
  clampNativeMapScale,
  nativeMapAnimatedTranslation,
  nativePinchFocal,
  pinchNativeMap,
  type NativeMapPoint,
  type NativeMapTransform,
  type NativeViewportSize
} from "../game/nativeMapTransform";

type TransformReference = { state: NativeMapTransform };
type NativeTransformWrapperProps = {
  children: React.ReactNode;
  limitToBounds?: boolean;
  centerOnInit?: boolean;
  initialScale?: number;
  minScale?: number;
  maxScale?: number;
  doubleClick?: { disabled?: boolean };
  onInit?: (ref: TransformReference) => void;
  onPanningStart?: (ref: TransformReference) => void;
  onPanning?: (ref: TransformReference) => void;
  onPanningStop?: (ref: TransformReference) => void;
  onTransformed?: (ref: TransformReference, state: NativeMapTransform) => void;
};
type NativeTransformComponentProps = {
  children: React.ReactNode;
  // Upstream web component accepts CSS-specific values such as flex: "none".
  // Those values are removed in this native adapter before reaching RN.
  wrapperStyle?: Record<string, unknown>;
  contentStyle?: Record<string, unknown>;
};

const Context = createContext<NativeTransformWrapperProps | null>(null);

/**
 * Native counterpart of the map's web TransformWrapper.
 * Avoid importing the DOM-based react-zoom-pan-pinch package on Android/iOS.
 * The outer wrapper remains inert; gesture handling lives in TransformComponent.
 */
export function TransformWrapper(props: NativeTransformWrapperProps) {
  return <Context.Provider value={props}>{props.children}</Context.Provider>;
}

function distance(a: { pageX: number; pageY: number }, b: { pageX: number; pageY: number }): number {
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

type GestureBaseline = {
  mode: "pan" | "pinch";
  start: NativeMapTransform;
  /** Frozen during the gesture; async measureInWindow may update the cache. */
  origin: NativeMapPoint;
  gestureDx: number;
  gestureDy: number;
  focal: NativeMapPoint;
  distance: number;
};

export function TransformComponent({ children, wrapperStyle, contentStyle }: NativeTransformComponentProps) {
  const options = useContext(Context);
  if (!options) throw new Error("TransformComponent must be under TransformWrapper");
  const propsRef = useRef(options);
  propsRef.current = options;

  const initial = useRef<NativeMapTransform>({
    positionX: 0, positionY: 0, scale: options.initialScale ?? 1
  });
  const [viewport, setViewport] = useState<NativeViewportSize>({ width: 0, height: 0 });
  const [contentSize, setContentSize] = useState<NativeViewportSize>({ width: 0, height: 0 });
  const viewportRef = useRef<View>(null);
  const windowOrigin = useRef<NativeMapPoint>({ x: 0, y: 0 });
  const initialized = useRef(false);
  const gestureBase = useRef<GestureBaseline | null>(null);
  const translationX = useRef(new Animated.Value(0)).current;
  const translationY = useRef(new Animated.Value(0)).current;
  const animatedScale = useRef(new Animated.Value(options.initialScale ?? 1)).current;
  const contentSizeRef = useRef(contentSize);
  contentSizeRef.current = contentSize;

  const updateWindowOrigin = useCallback(() => {
    viewportRef.current?.measureInWindow((x, y) => {
      windowOrigin.current = { x, y };
    });
  }, []);

  const apply = useCallback((next: NativeMapTransform) => {
    initial.current = next;
    const translated = nativeMapAnimatedTranslation(next, contentSizeRef.current);
    translationX.setValue(translated.x);
    translationY.setValue(translated.y);
    animatedScale.setValue(next.scale);
    const ref = { state: next };
    propsRef.current.onTransformed?.(ref, next);
    return ref;
  }, [translationX, translationY, animatedScale]);

  useEffect(() => {
    if (initialized.current || viewport.width <= 0 || viewport.height <= 0 ||
        contentSize.width <= 0 || contentSize.height <= 0) return;
    initialized.current = true;
    const scale = options.initialScale ?? 1;
    const state = options.centerOnInit
      ? centerNativeMap(viewport, contentSize, scale)
      : { positionX: 0, positionY: 0, scale };
    const ref = apply(state);
    propsRef.current.onInit?.(ref);
    updateWindowOrigin();
  }, [viewport.width, viewport.height, contentSize.width, contentSize.height, options.centerOnInit, options.initialScale, apply, updateWindowOrigin]);

  const beginGesture = useCallback((evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
    updateWindowOrigin();
    const touches = evt.nativeEvent.touches;
    const pinch = touches.length >= 2;
    const origin = { ...windowOrigin.current };
    gestureBase.current = {
      mode: pinch ? "pinch" : "pan",
      start: { ...initial.current },
      origin,
      gestureDx: gesture.dx,
      gestureDy: gesture.dy,
      focal: (pinch ? nativePinchFocal(touches, origin) : null) ?? { x: 0, y: 0 },
      distance: pinch ? Math.max(1, distance(touches[0]!, touches[1]!)) : 1
    };
    propsRef.current.onPanningStart?.({ state: initial.current });
  }, [updateWindowOrigin]);

  const moveGesture = useCallback((evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
    let baseline = gestureBase.current;
    if (!baseline) return;
    const touches = evt.nativeEvent.touches;
    const pinch = touches.length >= 2;
    if ((pinch && baseline.mode !== "pinch") || (!pinch && baseline.mode === "pinch")) {
      // Rebase when a second finger appears or disappears: no sudden jump.
      baseline = {
        mode: pinch ? "pinch" : "pan",
        start: { ...initial.current },
        origin: baseline.origin,
        gestureDx: gesture.dx,
        gestureDy: gesture.dy,
        focal: (pinch ? nativePinchFocal(touches, baseline.origin) : null) ?? { x: 0, y: 0 },
        distance: pinch ? Math.max(1, distance(touches[0]!, touches[1]!)) : 1
      };
      gestureBase.current = baseline;
    }

    let next: NativeMapTransform;
    if (pinch) {
      const focal = nativePinchFocal(touches, baseline.origin);
      if (!focal) return;
      const desiredScale = baseline.start.scale * distance(touches[0]!, touches[1]!) / baseline.distance;
      next = pinchNativeMap(baseline.start, baseline.focal, focal, desiredScale,
        propsRef.current.minScale ?? 0.5, propsRef.current.maxScale ?? 3);
    } else {
      next = {
        ...baseline.start,
        positionX: baseline.start.positionX + gesture.dx - baseline.gestureDx,
        positionY: baseline.start.positionY + gesture.dy - baseline.gestureDy
      };
    }
    const ref = apply(next);
    propsRef.current.onPanning?.(ref);
  }, [apply]);

  const endGesture = useCallback(() => {
    gestureBase.current = null;
    propsRef.current.onPanningStop?.({ state: initial.current });
  }, []);

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (evt, gesture) =>
      evt.nativeEvent.touches.length >= 2 || Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6,
    onMoveShouldSetPanResponderCapture: (evt) => evt.nativeEvent.touches.length >= 2,
    onPanResponderGrant: beginGesture,
    onPanResponderMove: moveGesture,
    onPanResponderRelease: endGesture,
    onPanResponderTerminate: endGesture,
    onPanResponderTerminationRequest: () => true
  }), [beginGesture, moveGesture, endGesture]);

  const onViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport((previous) => previous.width === width && previous.height === height ? previous : { width, height });
    updateWindowOrigin();
  }, [updateWindowOrigin]);
  const onContentLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContentSize((previous) => previous.width === width && previous.height === height ? previous : { width, height });
  }, []);

  const flattenedContent = StyleSheet.flatten(contentStyle as StyleProp<ViewStyle>) ?? {};
  const { flex: _webFlex, ...nativeContentStyle } = flattenedContent;

  return (
    <View
      ref={viewportRef}
      onLayout={onViewportLayout}
      style={[styles.viewport, wrapperStyle as StyleProp<ViewStyle>]}
      {...responder.panHandlers}
    >
      <Animated.View
        onLayout={onContentLayout}
        style={[
          nativeContentStyle,
          styles.content,
          { transform: [{ translateX: translationX }, { translateY: translationY }, { scale: animatedScale }] }
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: "hidden", position: "relative" },
  content: { position: "absolute", left: 0, top: 0 }
});
