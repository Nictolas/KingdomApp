import { AppState, type AppStateStatus } from "react-native";
import {
  getOrologioGiocoInPausaSnapshot,
  subscribeOrologioGiocoInPausa
} from "../game/orologioGiocoSession";
import { setNativeResidentFrameBusActive } from "./nativeResidentFrameBus";

let initialized = false;
let foreground = true;

function updateFrameBusActivity(): void {
  setNativeResidentFrameBusActive(foreground && !getOrologioGiocoInPausaSnapshot());
}

function onAppStateChanged(next: AppStateStatus): void {
  foreground = next !== "background" && next !== "inactive";
  updateFrameBusActivity();
}

/**
 * One subscription per JS runtime, not one per resident. Called once by the
 * native renderer module during initialization; never imported from web.
 * The bus holds each resident's scheduled callback until game/app resume.
 */
export function ensureNativeResidentFrameLifecycle(): void {
  if (initialized) return;
  initialized = true;
  foreground = AppState.currentState !== "background" && AppState.currentState !== "inactive";
  subscribeOrologioGiocoInPausa(updateFrameBusActivity);
  AppState.addEventListener("change", onAppStateChanged);
  updateFrameBusActivity();
}
