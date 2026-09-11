export type CharacterCellLike = {
  id: number;
  cell: number;
  path?: readonly number[];
};

function nearestFreeCell(
  start: number,
  cols: number,
  rows: number,
  occupied: ReadonlySet<number>,
  isWalkable: (cell: number) => boolean
): number | null {
  const total = cols * rows;
  if (start >= 0 && start < total && !occupied.has(start) && isWalkable(start)) return start;
  const queue = [Math.max(0, Math.min(total - 1, start))];
  const visited = new Set(queue);
  while (queue.length > 0) {
    const cell = queue.shift()!;
    const col = cell % cols;
    const candidates = [cell - cols, cell + cols, ...(col > 0 ? [cell - 1] : []), ...(col < cols - 1 ? [cell + 1] : [])];
    for (const candidate of candidates) {
      if (candidate < 0 || candidate >= total || visited.has(candidate)) continue;
      if (!occupied.has(candidate) && isWalkable(candidate)) return candidate;
      visited.add(candidate);
      queue.push(candidate);
    }
  }
  return null;
}

/**
 * Assegna una cella esclusiva a ogni personaggio visibile. L'ordine ricevuto è
 * la priorità stabile; eventuali duplicati vengono spostati sulla cella libera
 * e percorribile più vicina, senza alterare lo stato persistito.
 *
 * Eccezione: uscita da edificio — se la cella è interna (non walkable) e c’è un path,
 * si mantiene così Phaser può animare interior → porta.
 */
export function assignUniqueCharacterCells<T extends CharacterCellLike>(
  characters: readonly T[],
  cols: number,
  rows: number,
  isWalkable: (cell: number) => boolean
): T[] {
  const occupied = new Set<number>();
  return characters.map((character) => {
    const exitingInterior =
      !!character.path?.length && character.cell >= 0 && !isWalkable(character.cell);
    if (exitingInterior) {
      occupied.add(character.cell);
      occupied.add(character.path![0]!);
      return character;
    }
    const cell = nearestFreeCell(character.cell, cols, rows, occupied, isWalkable);
    if (cell == null) return character;
    occupied.add(cell);
    if (cell === character.cell) return character;
    const path = character.path?.length
      ? [cell, ...character.path.slice(character.path[0] === character.cell ? 1 : 0)]
      : character.path;
    return { ...character, cell, path };
  });
}
