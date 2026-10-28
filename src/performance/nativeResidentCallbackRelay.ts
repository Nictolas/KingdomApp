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
  private latest: NativeResidentLiveCallbacks;

  constructor(initial: NativeResidentLiveCallbacks) {
    this.latest = initial;
  }

  update(next: NativeResidentLiveCallbacks): void {
    this.latest = next;
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

  bound(): NativeResidentLiveCallbacks {
    const current = this.latest;
    return {
      onPress: current.onPress ? this.onPress : undefined,
      onDoublePress: current.onDoublePress ? this.onDoublePress : undefined,
      onCommuteComplete: current.onCommuteComplete ? this.onCommuteComplete : undefined,
      onCommuteBlocked: current.onCommuteBlocked ? this.onCommuteBlocked : undefined,
      onCellSettled: current.onCellSettled ? this.onCellSettled : undefined,
      isCellFreeForMe: current.isCellFreeForMe ? this.isCellFreeForMe : undefined,
      tryClaimCell: current.tryClaimCell ? this.tryClaimCell : undefined,
      releaseMyCell: current.releaseMyCell ? this.releaseMyCell : undefined
    };
  }
}
