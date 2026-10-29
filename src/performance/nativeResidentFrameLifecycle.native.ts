import { AppState, type AppStateStatus } from "react-native";
import {
  getOrologioGiocoInPausaSnapshot,
  subscribeOrologioGiocoInPausa
} from "../game/orologioGiocoSession";
import { setNativeResidentFrameBusActive } from "./nativeResidentFrameBus";
import { setNativeResidentTimerQueueActive } from "./nativeResidentTimerQueue";
import { applyNativeResidentSchedulerActivity } from "./nativeResidentSchedulerActivity";
import { NativeResidentLifecycleBootstrap } from "./nativeResidentLifecycleBootstrap";

function isForeground(state: AppStateStatus | null): boolean {
  return state !== "background" && state !== "inactive";
}

/**
 * One lifecycle registration for ALL native resident sprites.
 * Initialization is retryable: a transient native bridge/subscription fault
 * cannot permanently mark the resident schedulers as initialized while the
 * AppState or game-clock listener is missing.
 *
 * No extra per-resident AppState listeners, timers, RAFs or React updates.
 */
const lifecycle = new NativeResidentLifecycleBootstrap({
  readForeground: () => isForeground(AppState.currentState),
  readGamePaused: getOrologioGiocoInPausaSnapshot,
  applyActive: active => applyNativeResidentSchedulerActivity(
    active, setNativeResidentTimerQueueActive, setNativeResidentFrameBusActive
  ),
  subscribeGamePaused: listener => subscribeOrologioGiocoInPausa(listener),
  subscribeForeground: listener => {
    const subscription = AppState.addEventListener("change", next =>
      listener(isForeground(next))
    );
    return () => subscription.remove();
  }
});

export function ensureNativeResidentFrameLifecycle(): void {
  lifecycle.ensure();
}
