import {
  frameGroupStart,
  walkFrameFromElapsedMs,
  walkIndexInGroup,
  type WanderDirection
} from "../game/mapWandererMotion";

/**
 * Native-only sprite-sheet frame controller.
 *
 * The parent resident updates one Animated.Value for the image's horizontal
 * offset instead of committing a React render on every 180 ms walking frame.
 * Position, hit target, occupancy and the actual movement clock are owned
 * by the existing native resident component; this class only selects pixels.
 *
 * The output is an absolute pixel offset, not a relative animation. This
 * makes pause, speed changes, new segments and remounts deterministic.
 */
export class NativeResidentSpriteFrameDriver {
  private direction: WanderDirection = "s";
  private moving = false;
  private walkFrame = 0;
  private cellSizePx: number;
  private offsetPx = 0;
  private publishes = 0;

  constructor(cellSizePx: number, private readonly publish: (leftPx: number) => void) {
    this.cellSizePx = NativeResidentSpriteFrameDriver.validCellSize(cellSizePx);
  }

  private static validCellSize(px: number): number {
    if (!Number.isFinite(px) || px <= 0) {
      throw new Error("Invalid native resident sprite cell size");
    }
    return px;
  }

  private update(): void {
    const index = frameGroupStart(this.direction) +
      walkIndexInGroup(this.direction, this.walkFrame, this.moving);
    const next = -index * this.cellSizePx;
    if (next === this.offsetPx) return;
    this.offsetPx = next;
    this.publishes++;
    this.publish(next);
  }

  face(direction: WanderDirection): void {
    if (direction === this.direction) return;
    this.direction = direction;
    this.update();
  }

  setMoving(moving: boolean): void {
    if (this.moving === moving && (moving || this.walkFrame === 0)) return;
    this.moving = moving;
    if (!moving) this.walkFrame = 0;
    this.update();
  }

  /** Called with the scaled, pause-aware elapsed time from the segment. */
  advanceElapsed(elapsedMs: number): void {
    const next = walkFrameFromElapsedMs(elapsedMs);
    if (next === this.walkFrame) return;
    this.walkFrame = next;
    this.update();
  }

  /** Layout changes require a new pixel offset but not a new animation. */
  setCellSize(cellSizePx: number): void {
    const next = NativeResidentSpriteFrameDriver.validCellSize(cellSizePx);
    if (next === this.cellSizePx) return;
    this.cellSizePx = next;
    this.update();
  }

  /** Diagnostic state only. Never exposes a resident identifier. */
  snapshot(): Readonly<{
    direction: WanderDirection;
    moving: boolean;
    walkFrame: number;
    offsetPx: number;
    publishes: number;
  }> {
    return {
      direction: this.direction,
      moving: this.moving,
      walkFrame: this.walkFrame,
      offsetPx: this.offsetPx,
      publishes: this.publishes
    };
  }
}
