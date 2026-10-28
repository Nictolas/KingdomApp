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
}
