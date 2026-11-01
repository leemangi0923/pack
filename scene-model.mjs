import { numberCells } from './numbering.mjs';

// World units are centimetres. Each pallet position has a 2 × 2cm footprint.
export function sceneModel(cells, placements) {
  if (!cells.length) return [];
  const minX = Math.min(...cells.map(cell => cell.x));
  const maxX = Math.max(...cells.map(cell => cell.x));
  const minY = Math.min(...cells.map(cell => cell.y));
  const maxY = Math.max(...cells.map(cell => cell.y));
  const numbers = numberCells(cells);
  return cells.map(({ x, y }) => ({
    key: `${x},${y}`, x: (x - (minX + maxX) / 2) * 2,
    z: (y - (minY + maxY) / 2) * 2,
    cellNumber: numbers.get(`${x},${y}`), pack: placements.get(`${x},${y}`) ?? null,
  }));
}
