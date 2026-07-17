/**
 * Maximum number of cards that can be moved as a single unit.
 *
 * FreeCell allows moving only one card at a time in principle; multi-card
 * "supermoves" are a convenience equivalent to shuffling cards through free
 * cells and empty columns. The number movable is:
 *
 *     (1 + freeCells) * 2 ^ emptyColumns
 *
 * When the destination is itself an empty column, that column cannot be used
 * as intermediate storage, so it is excluded from the exponent.
 */
export function maxMovable(
  freeCells: number,
  emptyColumns: number,
  toEmptyColumn = false,
): number {
  const usableEmpties = Math.max(0, emptyColumns - (toEmptyColumn ? 1 : 0))
  return (1 + freeCells) * 2 ** usableEmpties
}
