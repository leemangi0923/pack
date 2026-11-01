import { numberCells } from './numbering.mjs';

export function prepareRoutes(text, cells, startMap) {
  let routes;
  try { routes = JSON.parse(text); } catch { throw new Error('경로를 [[0,1,2],[2,3]] 형태의 배열로 입력해 주세요.'); }
  if (!Array.isArray(routes) || !routes.length || routes.length > 1000) {
    throw new Error('경로는 1개 이상, 1000개 이하로 입력해 주세요.');
  }
  const positions = new Map([...numberCells(cells)].map(([key, number]) => [number, key]));
  const result = new Map(startMap);
  const steps = [];
  let total = 0;
  for (const [index, route] of routes.entries()) {
    if (!Array.isArray(route) || route.length < 2 || route.some(n => !Number.isSafeInteger(n) || n < 0)) {
      throw new Error(`${index + 1}번째 경로에는 출발·도착을 포함해 정수 위치 번호를 2개 이상 넣어 주세요.`);
    }
    total += route.length;
    if (total > 10000) throw new Error('전체 경로 지점은 10000개 이하로 입력해 주세요.');
    for (const number of route) {
      if (!positions.has(number)) throw new Error(`${index + 1}번째 경로의 ${number}번 위치는 파레트에 없습니다.`);
    }
    let from = positions.get(route[0]);
    const pack = result.get(from);
    if (!pack) throw new Error(`${index + 1}번째 경로의 출발 위치 ${route[0]}번에 팩이 없습니다.`);
    for (let i = 1; i < route.length; i++) {
      const to = positions.get(route[i]);
      if (from !== to && result.has(to)) throw new Error(`${index + 1}번째 경로의 ${route[i]}번 위치에 다른 팩이 있습니다.`);
      steps.push({ from, to, pack, route: index, fromNumber: route[i - 1], toNumber: route[i] });
      result.delete(from); result.set(to, pack); from = to;
    }
  }
  return { routes, steps, result };
}
