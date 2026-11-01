// Number every position in the selected bounding rectangle, including gaps.
export function numberCells(cells) {
  if (cells.length === 0) return new Map();
  const minX = Math.min(...cells.map(cell => cell.x));
  const minY = Math.min(...cells.map(cell => cell.y));
  const width = Math.max(...cells.map(cell => cell.x)) - minX + 1;
  return new Map(cells.map(({ x, y }) => [
    `${x},${y}`, (y - minY) * width + x - minX,
  ]));
}
