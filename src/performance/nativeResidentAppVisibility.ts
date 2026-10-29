/**
 * Native-only foreground/focus policy for the resident RAF and timer queues.
 *
 * React Native may report a null AppState during bridge initialization.
 * Unknown states MUST NOT be interpreted as foreground; only "active" is
 * authoritative. Android can emit blur/focus without an AppState change
 * (e.g. the notification shade), which must also suspend native resident work.
 *
 * No per-resident timers, endless polling, personal data, storage, game clock or web dependencies.
 * A bounded boot-only snapshot check handles asynchronous native initialization.
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

  get unresolved(): boolean {
    return this.state === null || this.state === "unknown";
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

export type NativeResidentBootProbe = Readonly<{
  read: () => string | null | undefined;
  schedule: (callback: () => void, delayMs: number) => number;
  cancel: (id: number) => void;
}>;

export type NativeResidentVisibilitySubscriptions = Readonly<{
  onChange: (listener: (state: string) => void) => () => void;
  onBlur?: (listener: () => void) => () => void;
  onFocus?: (listener: () => void) => () => void;
  bootProbe?: NativeResidentBootProbe;
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
  // RN may change currentState from null to active without a change event.
  // Four bounded one-shot checks only on unresolved initial states, not a
  // per-resident timer and not recurring background polling.
  const probe = subscriptions.bootProbe;
  const delays = [50, 150, 450, 1000] as const;
  let probeHandle: number | null = null;
  let probeEpoch = 0;
  let attempts = 0;
  const cancelProbe = (): void => {
    probeEpoch++;
    const old = probeHandle;
    probeHandle = null;
    if (old !== null) probe?.cancel(old);
  };
  const scheduleProbe = (): void => {
    if (!probe || disposed || !visibility.unresolved || attempts >= delays.length) return;
    const epoch = ++probeEpoch;
    const id = probe.schedule(() => {
      if (disposed || epoch !== probeEpoch) return;
      probeHandle = null;
      const current = visibility.setAppState(probe.read());
      if (visibility.unresolved) scheduleProbe();
      else emit(current);
    }, delays[attempts++]!);
    if (disposed || epoch !== probeEpoch) probe.cancel(id);
    else probeHandle = id;
  };
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    let failed = false;
    let firstError: unknown = undefined;
    try { cancelProbe(); }
    catch (error) { failed = true; firstError = error; }
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
      if (!visibility.unresolved) cancelProbe();
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
    // A second read covers a bridge resolution during registration itself.
    if (probe && visibility.unresolved) {
      const fresh = visibility.setAppState(probe.read());
      if (visibility.unresolved) scheduleProbe();
      else emit(fresh);
    }
  } catch (error) {
    // A listener registered earlier must not survive a later failing
    // subscription. Preserve even falsy values thrown by the first failure.
    try { dispose(); } catch { /* original registration fault takes priority */ }
    throw error;
  }
  return dispose;
}
