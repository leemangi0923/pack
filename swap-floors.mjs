import { numberCells, layerOffsets } from './numbering.mjs';

export function swapFloorKey(key) {
  const [x,y,level] = key.split(',').map(Number);
  return `${x},${y},${level === 0 ? 1 : level === 1 ? 0 : level}`;
}
function positions(layers) {
  const cells = layers.map(layer => layer ? [...layer.values()] : []);
  const offsets = layerOffsets(cells);
  return new Map(cells.flatMap((layer,index) => [...numberCells(layer,offsets[index])].map(([key,number]) => [number,`${key},${index}`])));
}
export function swapFloors(state) {
  if (!state.layers[0] || !state.layers[1]) throw new Error('1층과 2층을 먼저 만들어 주세요.');
  const layers = state.layers.map(layer => layer ? new Map([...layer].map(([key,cell]) => [key,{...cell}])) : null);
  [layers[0], layers[1]] = [layers[1], layers[0]];
  const sourcePositions = positions(state.layers);
  const targetNumbers = new Map([...positions(layers)].map(([number,key]) => [key,number]));
  let routeText = state.routeText, warning = '';
  if (routeText.trim()) {
    try {
      const routes = JSON.parse(routeText);
      if (!Array.isArray(routes) || routes.some(route => !Array.isArray(route) || route.some(number => !Number.isSafeInteger(number) || !sourcePositions.has(number)))) throw new Error('Invalid routes');
      routeText = JSON.stringify(routes.map(route => route.map(number => targetNumbers.get(swapFloorKey(sourcePositions.get(number))))));
    } catch {
      warning = '입력 중인 경로는 그대로 보존했습니다. 층이 바뀌었으므로 위치 번호를 확인해 주세요.';
    }
  }
  return {
    ...state, layers, activeLayer: state.activeLayer === 0 ? 1 : state.activeLayer === 1 ? 0 : state.activeLayer,
    placements: new Map([...state.placements].map(([key,pack]) => [swapFloorKey(key),pack])),
    destination: new Map([...state.destination].map(([key,pack]) => [swapFloorKey(key),pack])),
    routeText, warning,
  };
}
