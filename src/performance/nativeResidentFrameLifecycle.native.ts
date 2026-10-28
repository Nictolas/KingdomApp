import { AppState, type AppStateStatus } from "react-native";
import {
  getOrologioGiocoInPausaSnapshot,
  subscribeOrologioGiocoInPausa
} from "../game/orologioGiocoSession";
import { NativeResidentActivityGate } from "./nativeResidentActivityGate";
import { setNativeResidentFrameBusActive } from "./nativeResidentFrameBus";

let initialized = false;
let gate: NativeResidentActivityGate | null = null;

function isForeground(state: AppStateStatus | null): boolean {
  return state !== "background" && state !== "inactive";
}

function onAppStateChanged(next: AppStateStatus): void {
  gate?.setForeground(isForeground(next));
}

/**
 * A single lifecycle subscription is shared by all resident sprites.
 *
 * No per-NPC AppState listeners, timers or React state updates. Game pause and
 * background are combined: foregrounding never resumes a manually paused game.
 */
export function ensureNativeResidentFrameLifecycle(): void {
  if (initialized) return;
  initialized = true;
  gate = new NativeResidentActivityGate(
    isForeground(AppState.currentState),
    getOrologioGiocoInPausaSnapshot(),
    setNativeResidentFrameBusActive
  );
  subscribeOrologioGiocoInPausa(() => {
    gate?.setGamePaused(getOrologioGiocoInPausaSnapshot());
  });
  AppState.addEventListener("change", onAppStateChanged);
}
