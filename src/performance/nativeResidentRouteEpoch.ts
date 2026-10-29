/** Native-only ownership token for an active commute effect.
 * Invalidates late timer, collision retry and arrival callbacks after
 * route replacement or unmount. No storage, game-state or web dependency.
 */
export class NativeResidentRouteEpoch {
  private generation = 0;

  begin(): number {
    this.generation++;
    return this.generation;
  }

  invalidate(): void {
    this.generation++;
  }

  isCurrent(token: number): boolean {
    return token > 0 && token === this.generation;
  }

  /**
   * A parent callback can synchronously cancel/restart a route. Checking
   * ownership only before the callback is insufficient: the caller must
   * skip its next segment/completion when the callback invalidates it.
   *
   * Returning false says ONLY that the old route is no longer current;
   * it does not undo the callback's own effects.
   */
  runIfCurrent(token: number, callback: () => void): boolean {
    if (!this.isCurrent(token)) return false;
    callback();
    return this.isCurrent(token);
  }
}
