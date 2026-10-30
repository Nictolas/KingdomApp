import { AppState, Platform } from "react-native";
import {
  getOrologioGiocoInPausaSnapshot,
  subscribeOrologioGiocoInPausa
} from "../game/orologioGiocoSession";
import { setNativeResidentFrameBusActive } from "./nativeResidentFrameBus";
import { setNativeResidentTimerQueueActive } from "./nativeResidentTimerQueue";
import { applyNativeResidentSchedulerActivity } from "./nativeResidentSchedulerActivity";
import { NativeResidentLifecycleBootstrap } from "./nativeResidentLifecycleBootstrap";
import {
  NativeResidentAppVisibility,
  observeNativeResidentAppVisibility
} from "./nativeResidentAppVisibility";

// On Android the notification drawer may emit blur while AppState stays
// "active". The visibility gate also treats an initial null/unknown state
// as paused until the native bridge confirms "active".
const visibility = new NativeResidentAppVisibility(
  AppState.currentState, Platform.OS === "android"
);

/**
 * One lifecycle registration for ALL native resident sprites.
 * Initialization is retryable: a transient native bridge/subscription fault
 * cannot permanently mark the resident schedulers as initialized while the
 * AppState or game-clock listener is missing.
 *
 * No extra per-resident AppState listeners, timers, RAFs or React updates.
 */
const lifecycle = new NativeResidentLifecycleBootstrap({
  readForeground: () => visibility.setAppState(AppState.currentState),
  readGamePaused: getOrologioGiocoInPausaSnapshot,
  applyActive: active => applyNativeResidentSchedulerActivity(
    active, setNativeResidentTimerQueueActive, setNativeResidentFrameBusActive
  ),
  subscribeGamePaused: listener => subscribeOrologioGiocoInPausa(listener),
  subscribeForeground: listener => observeNativeResidentAppVisibility(
    visibility,
    {
      onChange: callback => {
        const sub = AppState.addEventListener("change", callback);
        return () => sub.remove();
      },
      onBlur: callback => {
        const sub = AppState.addEventListener("blur", callback);
        return () => sub.remove();
      },
      onFocus: callback => {
        const sub = AppState.addEventListener("focus", callback);
        return () => sub.remove();
      },
      // Only if the initial AppState bridge snapshot is null/unknown.
      // Bounded one-shot rechecks: never one timer per walker.
      bootProbe: {
        read: () => AppState.currentState,
        schedule: (fn, delay) => setTimeout(fn, delay) as unknown as number,
        cancel: id => clearTimeout(id)
      }
    },
    listener
  )
});

export function ensureNativeResidentFrameLifecycle(): void {
  lifecycle.ensure();
}
