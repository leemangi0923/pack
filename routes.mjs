import { numberCells, layerOffsets } from './numbering.mjs';
import { layerElevations, stackScene } from './scene-model.mjs';

function intersects(a, b, center, radius) {
  let enter = 0, leave = 1;
  for (let axis = 0; axis < 3; axis++) {
    const delta = b[axis] - a[axis];
    if (!delta) { if (Math.abs(a[axis] - center[axis]) >= radius[axis]) return false; }
    else {
      const lo = (center[axis] - radius[axis] - a[axis]) / delta;
      const hi = (center[axis] + radius[axis] - a[axis]) / delta;
      enter = Math.max(enter, Math.min(lo, hi)); leave = Math.min(leave, Math.max(lo, hi));
    }
  }
  return enter < leave;
}

export function prepareRoutes(text, cells, startMap, offset = 0, collisionMode = 'stop') {
  let routes;
  try { routes = JSON.parse(text); } catch { throw new Error('경로를 [[0,1,2],[2,3]] 형태의 배열로 입력해 주세요.'); }
  if (!Array.isArray(routes) || !routes.length || routes.length > 1000) throw new Error('경로는 1개 이상, 1000개 이하로 입력해 주세요.');
  const multi = cells.some(c => c.level !== undefined);
  const groups = [0,1,2].map(level => cells.filter(c => c.level === level));
  const offsets = layerOffsets(groups);
  const keyOf = c => multi ? `${c.x},${c.y},${c.level}` : `${c.x},${c.y}`;
  const positions = multi ? new Map(groups.flatMap((group,level) => [...numberCells(group,offsets[level])].map(([key,n]) => [n,`${key},${level}`])))
    : new Map([...numberCells(cells,offset)].map(([key,n]) => [n,key]));
  const numbers = new Map([...positions].map(([n,key]) => [key,n]));
  const kinds = new Map(cells.map(c => [keyOf(c),c.kind]));
  const elevations = layerElevations([0,1,2].map(level => ({cells:cells.filter(c => (c.level??0)===level),placements:new Map([...startMap].filter(([key]) => (Number(key.split(',')[2])||0)===level))})));
  const makeModel = state => cells.map(cell=>({...cell,key:keyOf(cell),z:cell.y,level:cell.level??0,pack:state.get(keyOf(cell))}));
  const reference = new Map(stackScene(makeModel(startMap),elevations).map(item=>[item.key,item.elevation]));
  const getBases = state => new Map(stackScene(makeModel(state),elevations,reference).map(item=>[item.key,item.elevation]));
  let bases = getBases(startMap);
  const base = key => bases.get(key) ?? elevations[Number(key.split(',')[2])||0];
  const center = (key,height) => { const [x,y] = key.split(',').map(Number); return [x*4,height,y*4]; };
  const result = new Map(startMap), steps = [];
  const climb = collisionMode === 'climb';
  let total = 0;
  for (const [index,route] of routes.entries()) {
    if (!Array.isArray(route) || route.length < 2 || route.some(n => !Number.isSafeInteger(n)||n<0)) throw new Error(`${index+1}번째 경로에는 정수 위치 번호를 2개 이상 넣어 주세요.`);
    total += route.length; if (total > 10000) throw new Error('전체 경로 지점은 10000개 이하로 입력해 주세요.');
    for (const n of route) if (!positions.has(n)) throw new Error(`${index+1}번째 경로의 ${n}번 위치는 파레트에 없습니다.`);
    const final = positions.get(route.at(-1));
    if (kinds.get(final)==='hole') throw new Error(`${route.at(-1)}번 위치는 H 홀이므로 이동을 끝낼 수 없습니다.`);
    bases = getBases(result);
    let from = positions.get(route[0]), fromHeight = base(from);
    const pack = result.get(from);
    if (!pack) throw new Error(`${index+1}번째 경로의 출발 위치 ${route[0]}번에 팩이 없습니다.`);
    const height = pack.height ?? 4;
    for (let i=1;i<route.length;i++) {
      bases = getBases(result);
      const to = positions.get(route[i]), occupant = result.get(to);
      const fixed = ['fixed','fixed-circle'].includes(kinds.get(to));
      const occupied = fixed || (occupant && occupant!==pack);
      if (occupied && (i===route.length-1 || !climb)) throw new Error(`부딪힘이 감지되었습니다: ${route[i]}번 위치에 ${fixed?'X 고정팩':'다른 팩'}이 있습니다.${i===route.length-1?' 최종 도착 칸은 비워 주세요.':''}`);
      const toHeight = base(to) + (occupied ? (fixed?6:occupant.height??4)+.15 : 0);
      const a = center(from,fromHeight+height/2), b = center(to,toHeight+height/2);
      let travelHeight = Math.max(fromHeight,toHeight), over = !!occupied;
      const obstacles = [...result].filter(([,p]) => p!==pack).map(([key,p]) => ({key,height:p.height??4}));
      for (const cell of cells) if (['fixed','fixed-circle'].includes(cell.kind)) obstacles.push({key:keyOf(cell),height:6,fixed:true});
      for (const obstacle of obstacles) {
        const c = center(obstacle.key,base(obstacle.key)+obstacle.height/2);
        if (!intersects(a,b,c,[(2+(pack.width??2))/2,(obstacle.height+height)/2,(2+(pack.width??2))/2])) continue;
        if (!climb) throw new Error(`부딪힘이 감지되었습니다: ${numbers.get(obstacle.key)}번 위치의 ${obstacle.fixed?'X 고정팩':'다른 팩'}과 이동 구간이 겹칩니다.`);
        over = true; travelHeight = Math.max(travelHeight,base(obstacle.key)+obstacle.height+.15);
      }
      const landed = !occupied;
      steps.push({from,to,pack,route:index,fromNumber:route[i-1],toNumber:route[i],fromHeight,toHeight,travelHeight,over,landed});
      if (result.get(from)===pack) result.delete(from);
      if (landed) result.set(to,pack);
      from = to; fromHeight = toHeight;
    }
  }
  return {routes,steps,result};
}

export function routeState(startMap, steps, count) {
  const map = new Map(startMap); let traveller = null;
  for (const step of steps.slice(0,count)) {
    if (map.get(step.from)===step.pack) map.delete(step.from);
    if (step.landed!==false) { map.set(step.to,step.pack); traveller=null; }
    else traveller={key:step.to,pack:step.pack,elevation:step.toHeight};
  }
  return {map,traveller};
}
