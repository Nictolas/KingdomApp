/**
 * Native-only resident event relay.
 *
 * The parent map creates fresh inline event handlers on every world-clock
 * update. Those handler identities must not force 200 expensive sprite
 * subtrees to render, but a later tap/arrival MUST invoke the latest handler.
 *
 * Only imperative event handlers belong here. Predicates that affect visual
 * output or motion-effect dependencies (isWalkable, isRoadCell and
 * passTouchesToMapOnCell) are deliberately NOT relayed: changing them must
 * still invalidate React.memo.
 *
 * No React dependency, persistence, gameplay state or platform API.
 */
export type NativeResidentCommutePurpose =
  | "work" | "bar" | "home" | "mensa" | "culto" | "negozio" | "rapina" | "cerca_lavoro";

export type NativeResidentCommuteBlocked = {
  fromCell: number;
  blockedCell: number;
  purpose: NativeResidentCommutePurpose;
};

export type NativeResidentLiveCallbacks = {
  onPress?: () => void;
  onDoublePress?: () => void;
  onCommuteComplete?: (purpose: NativeResidentCommutePurpose) => void;
  onCommuteBlocked?: (info: NativeResidentCommuteBlocked) => void;
  onCellSettled?: (cellIndex: number) => void;
  isCellFreeForMe?: (cellIndex: number) => boolean;
  tryClaimCell?: (cellIndex: number) => boolean;
  releaseMyCell?: () => void;
};

/**
 * Stable function references with a mutable target.
 * bound() preserves optional-handler presence, so an absent onPress does
 * not accidentally turn a non-interactive resident into a Pressable.
 */
export class NativeResidentCallbackRelay {
  /**
   * Store only the eight live callbacks. Retaining a whole MapWandererCharacter
   * props object here would retain paths, map predicates and other unrelated
   * render data across parent updates.
   *
   * The object is updated in place after React commit, with no new object per
   * parent clock tick. Bound functions always look up its current fields.
   */
  private readonly latest: NativeResidentLiveCallbacks = {};
  /** Sparse cache keyed by the eight optional-handler presence flags (0..255). */
  private readonly bindingByPresence: Array<NativeResidentLiveCallbacks | undefined> = [];

  constructor(initial: NativeResidentLiveCallbacks) {
    this.update(initial);
  }

  update(next: NativeResidentLiveCallbacks): void {
    this.latest.onPress = next.onPress;
    this.latest.onDoublePress = next.onDoublePress;
    this.latest.onCommuteComplete = next.onCommuteComplete;
    this.latest.onCommuteBlocked = next.onCommuteBlocked;
    this.latest.onCellSettled = next.onCellSettled;
    this.latest.isCellFreeForMe = next.isCellFreeForMe;
    this.latest.tryClaimCell = next.tryClaimCell;
    this.latest.releaseMyCell = next.releaseMyCell;
  }

  readonly onPress = (): void => { this.latest.onPress?.(); };
  readonly onDoublePress = (): void => { this.latest.onDoublePress?.(); };
  readonly onCommuteComplete = (purpose: NativeResidentCommutePurpose): void => {
    this.latest.onCommuteComplete?.(purpose);
  };
  readonly onCommuteBlocked = (info: NativeResidentCommuteBlocked): void => {
    this.latest.onCommuteBlocked?.(info);
  };
  readonly onCellSettled = (cellIndex: number): void => {
    this.latest.onCellSettled?.(cellIndex);
  };
  readonly isCellFreeForMe = (cellIndex: number): boolean =>
    this.latest.isCellFreeForMe?.(cellIndex) ?? true;
  readonly tryClaimCell = (cellIndex: number): boolean =>
    this.latest.tryClaimCell?.(cellIndex) ?? true;
  readonly releaseMyCell = (): void => { this.latest.releaseMyCell?.(); };

  /**
   * Presence comes from the prospective render, never from an uncommitted
   * handler body. When the presence mask is unchanged, return the exact same
   * bound object; 200 residents receiving repeated parent clock updates
   * create no transient relay-props objects.
   *
   * The cache holds at most one object per optional-presence combination and
   * intentionally never contains actual parent callbacks. It is read-only to
   * callers: the native wrapper spreads the object into a React element.
   */
  bound(presence: NativeResidentLiveCallbacks = this.latest): NativeResidentLiveCallbacks {
    const mask =
      (presence.onPress ? 1 : 0) |
      (presence.onDoublePress ? 2 : 0) |
      (presence.onCommuteComplete ? 4 : 0) |
      (presence.onCommuteBlocked ? 8 : 0) |
      (presence.onCellSettled ? 16 : 0) |
      (presence.isCellFreeForMe ? 32 : 0) |
      (presence.tryClaimCell ? 64 : 0) |
      (presence.releaseMyCell ? 128 : 0);
    let bound = this.bindingByPresence[mask];
    if (bound !== undefined) return bound;
    bound = {
      onPress: mask & 1 ? this.onPress : undefined,
      onDoublePress: mask & 2 ? this.onDoublePress : undefined,
      onCommuteComplete: mask & 4 ? this.onCommuteComplete : undefined,
      onCommuteBlocked: mask & 8 ? this.onCommuteBlocked : undefined,
      onCellSettled: mask & 16 ? this.onCellSettled : undefined,
      isCellFreeForMe: mask & 32 ? this.isCellFreeForMe : undefined,
      tryClaimCell: mask & 64 ? this.tryClaimCell : undefined,
      releaseMyCell: mask & 128 ? this.releaseMyCell : undefined
    };
    this.bindingByPresence[mask] = bound;
    return bound;
  }
}
