/**
 * Native-only foreground/focus policy for the resident RAF and timer queues.
 *
 * React Native may report a null AppState during bridge initialization.
 * Unknown states MUST NOT be interpreted as foreground; only "active" is
 * authoritative. Android can emit blur/focus without an AppState change
 * (e.g. the notification shade), which must also suspend native resident work.
 *
 * No timers, polling, personal data, storage, game clock or web dependencies.
 */
export class NativeResidentAppVisibility {
  private state: string | null;
  private androidFocused = true;

  constructor(initialState: string | null | undefined, readonly android: boolean) {
    this.state = initialState ?? null;
  }

  get foreground(): boolean {
    return this.state === "active" && (!this.android || this.androidFocused);
  }

  setAppState(state: string | null | undefined): boolean {
    this.state = state ?? null;
    return this.foreground;
  }

  setAndroidFocused(focused: boolean): boolean {
    if (this.android) this.androidFocused = focused;
    return this.foreground;
  }
}

export type NativeResidentVisibilitySubscriptions = Readonly<{
  onChange: (listener: (state: string) => void) => () => void;
  onBlur?: (listener: () => void) => () => void;
  onFocus?: (listener: () => void) => () => void;
}>;

/**
 * One subscription set for the entire native population, not per resident.
 * Installation and teardown attempt all removals even after a bridge failure.
 * Late already-queued notifications are ignored after disposal.
 *
 * Duplicate native notifications MUST still reach the lifecycle gate: a
 * transient RAF registration failure can be retried on a repeated "active"
 * event, without introducing any polling or background retry timer.
 */
export function observeNativeResidentAppVisibility(
  visibility: NativeResidentAppVisibility,
  subscriptions: NativeResidentVisibilitySubscriptions,
  listener: (foreground: boolean) => void
): () => void {
  if (visibility.android && (!subscriptions.onBlur || !subscriptions.onFocus)) {
    throw new Error("Android native visibility requires both blur and focus observers");
  }
  const remove: Array<() => void> = [];
  let disposed = false;
  const emit = (foreground: boolean): void => {
    if (!disposed) listener(foreground);
  };
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    let failed = false;
    let firstError: unknown = undefined;
    for (let i = remove.length - 1; i >= 0; i--) {
      try { remove[i]!(); }
      catch (error) {
        if (!failed) { failed = true; firstError = error; }
      }
    }
    remove.length = 0;
    if (failed) throw firstError;
  };
  try {
    remove.push(subscriptions.onChange(state => {
      if (disposed) return;
      emit(visibility.setAppState(state));
    }));
    if (visibility.android) {
      remove.push(subscriptions.onBlur!(() => {
        if (disposed) return;
        emit(visibility.setAndroidFocused(false));
      }));
      remove.push(subscriptions.onFocus!(() => {
        if (disposed) return;
        emit(visibility.setAndroidFocused(true));
      }));
    }
  } catch (error) {
    // A listener registered earlier must not survive a later failing
    // subscription. Preserve even falsy values thrown by the first failure.
    try { dispose(); } catch { /* original registration fault takes priority */ }
    throw error;
  }
  return dispose;
}
