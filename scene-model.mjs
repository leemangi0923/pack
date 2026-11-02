import { numberCells } from './numbering.mjs';

export function stackScene(model) {
  const tops = new Map();
  for (const item of model) {
    const column = `${item.x},${item.z}`;
    item.elevation = tops.get(column) ?? 0;
    const height = item.pack?.height ?? (['fixed', 'fixed-circle'].includes(item.kind) ? 6 : 0);
    tops.set(column, item.elevation + height);
  }
  return model;
}

// World units are centimetres. Each pallet position has a 4 × 4cm footprint.
export function sceneModel(cells, placements, alignment = cells, offset = 0) {
  if (!cells.length) return [];
  const minX = Math.min(...alignment.map(cell => cell.x));
  const maxX = Math.max(...alignment.map(cell => cell.x));
  const minY = Math.min(...alignment.map(cell => cell.y));
  const maxY = Math.max(...alignment.map(cell => cell.y));
  const numbers = numberCells(cells, offset);
  return cells.map(({ x, y, kind }) => ({
    kind,
    key: `${x},${y}`, x: (x - (minX + maxX) / 2) * 4,
    z: (y - (minY + maxY) / 2) * 4,
    cellNumber: numbers.get(`${x},${y}`), pack: placements.get(`${x},${y}`) ?? null,
  }));
}
