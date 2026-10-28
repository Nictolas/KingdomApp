import { beginNativeResidentDispatch, endNativeResidentDispatch } from "./nativeResidentDispatchProfiler";

/**
 * A single native timeout serves all resident idle and collision waits.
 *
 * Implementation: indexed min-heap of logical deadlines in ACTIVE time.
 * Scheduling and cancellation are O(log n), peeking is O(1); game pause
 * and app background suspend the virtual clock in O(1), without rewriting
 * the deadlines of 200+ resident tasks.
 *
 * No storage, polling, game-state writes or personal information.
 */
/** Cooperative JS-task budget; not a change to simulated game time. */
export const NATIVE_RESIDENT_TIMER_CALLBACK_BUDGET = 32;

type ResidentTimer = {
  id: number;
  callback: () => void;
  dueActiveMs: number;
};

/** Cumulative metrics never include resident identifiers or game data. */
export type NativeResidentTimerCounters = Readonly<{
  platformSchedules: number;
  platformCancellations: number;
  platformWakeups: number;
  logicalCallbacks: number;
  /** Number of wakeups that yielded with already-due callbacks still queued. */
  budgetYields: number;
}>;

export type NativeResidentTimerSnapshot = NativeResidentTimerCounters & Readonly<{
  pending: number;
  scheduled: boolean;
  active: boolean;
  nextDueInMs: number | null;
  callbackBudget: number;
  backlogDue: boolean;
}>;

export class NativeResidentTimerQueue {
  private heap: ResidentTimer[] = [];
  private positions = new Map<number, number>();
  /** Ready tasks are separate so callbacks can cancel siblings mid-flush. */
  private ready: Map<number, ResidentTimer> | null = null;
  private nextId = 1;
  private active = true;
  /** A pause/resume pair during a callback still invalidates this wakeup. */
  private activityEpoch = 0;
  private activeElapsedMs = 0;
  private lastWallMs: number | null = null;
  private timer: number | null = null;
  private timerDeadline: number | null = null;
  private generation = 0;
  private executing = false;
  private platformSchedules = 0;
  private platformCancellations = 0;
  private platformWakeups = 0;
  private logicalCallbacks = 0;
  private budgetYields = 0;

  constructor(
    private readonly now: () => number = () => performance.now(),
    private readonly schedulePlatform: (fn: () => void, ms: number) => number =
      (fn, ms) => setTimeout(fn, ms) as unknown as number,
    private readonly cancelPlatform: (id: number) => void =
      (id) => clearTimeout(id),
    private readonly maxCallbacksPerWake: number = Number.POSITIVE_INFINITY
  ) {
    if (maxCallbacksPerWake !== Number.POSITIVE_INFINITY &&
      (!Number.isSafeInteger(maxCallbacksPerWake) || maxCallbacksPerWake < 1)) {
      throw new Error("Invalid native resident timer callback budget");
    }
  }

  /**
   * Advance only while active. A wall-clock regression never moves backwards.
   * Even when paused, record the last wall timestamp so resume does not catch
   * up any elapsed time in the background.
   */
  private sampleActiveClock(): number {
    const raw = this.now();
    if (!Number.isFinite(raw)) return this.activeElapsedMs;
    if (this.lastWallMs === null) {
      this.lastWallMs = raw;
      return this.activeElapsedMs;
    }
    if (raw > this.lastWallMs) {
      if (this.active) this.activeElapsedMs += raw - this.lastWallMs;
      this.lastWallMs = raw;
    }
    return this.activeElapsedMs;
  }

  private compare(a: ResidentTimer, b: ResidentTimer): number {
    return a.dueActiveMs - b.dueActiveMs || a.id - b.id;
  }

  private swap(a: number, b: number): void {
    const x = this.heap[a]!;
    const y = this.heap[b]!;
    this.heap[a] = y;
    this.heap[b] = x;
    this.positions.set(y.id, a);
    this.positions.set(x.id, b);
  }

  private siftUp(index: number): void {
    while (index > 0) {
      const parent = (index - 1) >>> 1;
      if (this.compare(this.heap[parent]!, this.heap[index]!) <= 0) break;
      this.swap(parent, index);
      index = parent;
    }
  }

  private siftDown(index: number): void {
    while (true) {
      const left = index * 2 + 1;
      if (left >= this.heap.length) break;
      const right = left + 1;
      const smaller = right < this.heap.length &&
        this.compare(this.heap[right]!, this.heap[left]!) < 0 ? right : left;
      if (this.compare(this.heap[index]!, this.heap[smaller]!) <= 0) break;
      this.swap(index, smaller);
      index = smaller;
    }
  }

  private push(task: ResidentTimer): void {
    const index = this.heap.length;
    this.heap.push(task);
    this.positions.set(task.id, index);
    this.siftUp(index);
  }

  private removeAt(index: number): ResidentTimer {
    const removed = this.heap[index]!;
    const last = this.heap.pop()!;
    this.positions.delete(removed.id);
    if (index < this.heap.length) {
      this.heap[index] = last;
      this.positions.set(last.id, index);
      if (index > 0 &&
        this.compare(this.heap[index]!, this.heap[(index - 1) >>> 1]!) < 0) {
        this.siftUp(index);
      } else {
        this.siftDown(index);
      }
    }
    return removed;
  }

  schedule(callback: () => void, delayMs: number): number {
    if (!Number.isFinite(delayMs) || delayMs < 0) throw new Error("Invalid resident timer delay");
    const elapsed = this.sampleActiveClock();
    const id = this.nextId++;
    this.push({ id, callback, dueActiveMs: elapsed + delayMs });
    this.arm();
    return id;
  }

  cancel(id: number): void {
    const index = this.positions.get(id);
    if (index != null) {
      this.removeAt(index);
      this.arm();
    } else {
      // During a flush, another callback may cancel a due sibling.
      this.ready?.delete(id);
    }
  }

  setActive(active: boolean): void {
    if (this.active === active) return;
    this.sampleActiveClock(); // Record elapsed up to the transition.
    this.active = active;
    this.activityEpoch++;
    if (!active) this.dropTimer();
    else this.arm();
  }

  snapshot(): NativeResidentTimerSnapshot {
    const elapsed = this.sampleActiveClock();
    const next = this.heap[0]?.dueActiveMs ?? null;
    return {
      pending: this.heap.length + (this.ready?.size ?? 0),
      scheduled: this.timer !== null,
      active: this.active,
      nextDueInMs: this.active && next !== null ? Math.max(0, next - elapsed) : null,
      platformSchedules: this.platformSchedules,
      platformCancellations: this.platformCancellations,
      platformWakeups: this.platformWakeups,
      logicalCallbacks: this.logicalCallbacks,
      budgetYields: this.budgetYields,
      callbackBudget: this.maxCallbacksPerWake,
      backlogDue: this.active && next !== null && next <= elapsed
    };
  }

  private dropTimer(): void {
    if (this.timer !== null) {
      this.cancelPlatform(this.timer);
      this.platformCancellations++;
    }
    this.timer = null;
    this.timerDeadline = null;
    this.generation++;
  }

  private arm(): void {
    if (!this.active || this.executing) return;
    const elapsed = this.sampleActiveClock();
    const deadline = this.heap[0]?.dueActiveMs ?? null;
    if (deadline === this.timerDeadline && this.timer !== null) return;
    this.dropTimer();
    if (deadline === null) return;
    const generation = this.generation;
    this.timerDeadline = deadline;
    this.timer = this.schedulePlatform(() => this.flush(generation), Math.max(0, deadline - elapsed));
    this.platformSchedules++;
  }

  private flush(generation: number): void {
    // Canceled callbacks can arrive late from the RN bridge.
    if (!this.active || this.timer === null || generation !== this.generation) return;
    const timing = beginNativeResidentDispatch("timer");
    this.timer = null;
    this.timerDeadline = null;
    this.executing = true;
    this.platformWakeups++;
    let firstError: unknown = null;
    try {
      // Extract a bounded prefix of tasks due when this OS tick started.
      // The heap retains the remainder, so each callback can still cancel
      // a sibling. A callback scheduling a zero-delay task cannot execute it
      // during this tick. Equal deadlines remain FIFO by registration ID.
      const cutoff = this.sampleActiveClock();
      const dispatchEpoch = this.activityEpoch;
      this.ready = new Map();
      while (this.heap.length > 0 &&
        this.ready.size < this.maxCallbacksPerWake &&
        this.heap[0]!.dueActiveMs <= cutoff) {
        const task = this.removeAt(0);
        this.ready.set(task.id, task);
      }
      const extracted = this.ready.size;
      for (const [id, task] of this.ready) {
        if (!this.active || this.activityEpoch !== dispatchEpoch) break;
        if (!this.ready.has(id)) continue;
        this.ready.delete(id);
        this.logicalCallbacks++;
        try {
          task.callback();
        } catch (error) {
          // One broken resident does not prevent others from waking.
          if (firstError === null) firstError = error;
        }
      }
      // Cooperative yield: already-due work is retained for the next
      // platform task instead of monopolizing the JS thread for 200+ NPCs.
      // Check *after* callbacks: they may have canceled the entire backlog.
      if (this.active && this.activityEpoch === dispatchEpoch &&
        extracted === this.maxCallbacksPerWake &&
        this.heap.length > 0 && this.heap[0]!.dueActiveMs <= cutoff) {
        this.budgetYields++;
      }
    } finally {
      if (this.ready != null) {
        // A mid-batch pause leaves untouched tasks due in active time.
        // Reinsertion preserves deadline and registration order.
        for (const task of this.ready.values()) this.push(task);
      }
      this.ready = null;
      this.executing = false;
      try {
        this.arm();
      } finally {
        endNativeResidentDispatch("timer", timing);
      }
    }
    if (firstError !== null) throw firstError;
  }
}

// Only the native singleton is budgeted. The default class remains unbounded
// for existing reference-model tests and explicit comparison benchmarks.
const residentTimerQueue = new NativeResidentTimerQueue(
  undefined, undefined, undefined, NATIVE_RESIDENT_TIMER_CALLBACK_BUDGET
);

export function scheduleNativeResidentTimer(fn: () => void, delayMs: number): number {
  return residentTimerQueue.schedule(fn, delayMs);
}

export function cancelNativeResidentTimer(id: number): void {
  residentTimerQueue.cancel(id);
}

export function setNativeResidentTimerQueueActive(active: boolean): void {
  residentTimerQueue.setActive(active);
}

/** Read-only aggregate diagnostic; no IDs, positions, storage or network. */
export function getNativeResidentTimerSnapshot(): NativeResidentTimerSnapshot {
  return residentTimerQueue.snapshot();
}
