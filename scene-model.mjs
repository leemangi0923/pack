import { numberCells } from './numbering.mjs';

export function layerElevations(layers) {
  let elevation = 0;
  return layers.map(layer => {
    const base = elevation;
    const heights = [...layer.placements.values()].map(pack => pack.height);
    if (layer.cells.some(cell => ['fixed', 'fixed-circle'].includes(cell.kind))) heights.push(6);
    elevation += heights.length ? Math.max(...heights) : 6;
    return base;
  });
}

export function stackScene(model, elevations) {
  elevations ??= layerElevations([0, 1, 2].map(level => ({
    cells: model.filter(item => (item.level ?? 0) === level),
    placements: new Map(model.filter(item => (item.level ?? 0) === level && item.pack).map((item, i) => [i, item.pack])),
  })));
  for (const item of model) {
    item.elevation = elevations[item.level ?? 0];
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
