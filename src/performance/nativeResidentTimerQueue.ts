/**
 * One native timeout drives every resident's idle and blocked-commute retry.
 * Deadline order is stable; callbacks still own the same gameplay decisions.
 *
 * Crucially, the queue does not advance timers while the world is paused or
 * the app is backgrounded. No background polling or persistence is involved.
 */
export class NativeResidentTimerQueue {
  private tasks = new Map<number, { callback: () => void; remainingMs: number; deadline: number }>();
  private nextId = 1;
  private active = true;
  private timer: number | null = null;
  private timerDeadline: number | null = null;
  private generation = 0;
  private executing = false;

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly schedulePlatform: (fn: () => void, ms: number) => number =
      (fn, ms) => setTimeout(fn, ms) as unknown as number,
    private readonly cancelPlatform: (id: number) => void =
      (id) => clearTimeout(id)
  ) {}

  schedule(callback: () => void, delayMs: number): number {
    if (!Number.isFinite(delayMs) || delayMs < 0) throw new Error("Invalid resident timer delay");
    const id = this.nextId++;
    const current = this.now();
    this.tasks.set(id, {
      callback,
      remainingMs: delayMs,
      deadline: this.active ? current + delayMs : Number.POSITIVE_INFINITY
    });
    this.arm();
    return id;
  }

  cancel(id: number): void {
    if (!this.tasks.delete(id)) return;
    this.arm();
  }

  setActive(active: boolean): void {
    if (this.active === active) return;
    const current = this.now();
    if (!active) {
      for (const task of this.tasks.values()) {
        task.remainingMs = Math.max(0, task.deadline - current);
        task.deadline = Number.POSITIVE_INFINITY;
      }
      this.active = false;
      this.dropTimer();
    } else {
      this.active = true;
      for (const task of this.tasks.values()) {
        task.deadline = current + task.remainingMs;
      }
      this.arm();
    }
  }

  snapshot(): { pending: number; scheduled: boolean; active: boolean; nextDueInMs: number | null } {
    const earliest = this.earliestDeadline();
    return {
      pending: this.tasks.size,
      scheduled: this.timer !== null,
      active: this.active,
      nextDueInMs: this.active && earliest !== null ? Math.max(0, earliest - this.now()) : null
    };
  }

  private earliestDeadline(): number | null {
    if (!this.active || this.tasks.size === 0) return null;
    let earliest = Number.POSITIVE_INFINITY;
    for (const task of this.tasks.values()) earliest = Math.min(earliest, task.deadline);
    return Number.isFinite(earliest) ? earliest : null;
  }

  private dropTimer(): void {
    if (this.timer !== null) this.cancelPlatform(this.timer);
    this.timer = null;
    this.timerDeadline = null;
    this.generation++;
  }

  private arm(): void {
    if (!this.active || this.executing) return;
    const deadline = this.earliestDeadline();
    if (deadline === this.timerDeadline && this.timer !== null) return;
    this.dropTimer();
    if (deadline === null) return;
    const generation = this.generation;
    this.timerDeadline = deadline;
    this.timer = this.schedulePlatform(() => this.flush(generation), Math.max(0, deadline - this.now()));
  }

  private flush(generation: number): void {
    if (!this.active || this.timer === null || generation !== this.generation) return;
    this.timer = null;
    this.timerDeadline = null;
    this.executing = true;
    let firstError: unknown = null;
    try {
      // Only timers due at the beginning of this tick run here. Tasks created
      // by a callback run on a future OS timeout, even for zero delay.
      const due = [...this.tasks.entries()]
        .filter(([, task]) => task.deadline <= this.now())
        .sort((a, b) => a[1].deadline - b[1].deadline || a[0] - b[0]);
      for (const [id] of due) {
        if (!this.active) break;
        const task = this.tasks.get(id);
        if (!task) continue; // A previous task may cancel a sibling.
        this.tasks.delete(id);
        try {
          task.callback();
        } catch (error) {
          if (firstError === null) firstError = error;
        }
      }
    } finally {
      this.executing = false;
      this.arm();
    }
    if (firstError !== null) throw firstError;
  }
}

const residentTimerQueue = new NativeResidentTimerQueue();

export function scheduleNativeResidentTimer(fn: () => void, delayMs: number): number {
  return residentTimerQueue.schedule(fn, delayMs);
}

export function cancelNativeResidentTimer(id: number): void {
  residentTimerQueue.cancel(id);
}

export function setNativeResidentTimerQueueActive(active: boolean): void {
  residentTimerQueue.setActive(active);
}
