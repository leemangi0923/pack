import { numberCells, layerOffsets } from './numbering.mjs';

export function prepareRoutes(text, cells, startMap, offset = 0) {
  let routes;
  try { routes = JSON.parse(text); } catch { throw new Error('경로를 [[0,1,2],[2,3]] 형태의 배열로 입력해 주세요.'); }
  if (!Array.isArray(routes) || !routes.length || routes.length > 1000) {
    throw new Error('경로는 1개 이상, 1000개 이하로 입력해 주세요.');
  }
  const multi=cells.some(c=>c.level!==undefined);
  const groups=[0,1,2].map(level=>cells.filter(c=>c.level===level));
  const offsets=layerOffsets(groups);
  const keyOf=c=>multi?`${c.x},${c.y},${c.level}`:`${c.x},${c.y}`;
  const positions = multi ? new Map(groups.flatMap((group,level)=>[...numberCells(group,offsets[level])].map(([key,number])=>[number,`${key},${level}`]))) : new Map([...numberCells(cells,offset)].map(([key,number])=>[number,key]));
  const kinds=new Map(cells.map(c=>[keyOf(c),c.kind]));
  const result = new Map(startMap);
  const baseHeight = (x,y,level,state) => cells.filter(c=>c.x===x&&c.y===y&&(c.level??0)<level)
    .reduce((height,c)=>height+(state.get(keyOf(c))?.height??(['fixed','fixed-circle'].includes(c.kind)?6:0)),0);
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
    for (const number of route) {
      if (['fixed', 'fixed-circle'].includes(kinds.get(positions.get(number)))) throw new Error(`${number}번 위치는 X 고정팩이 있어 이동할 수 없습니다.`);
    }
    if (kinds.get(positions.get(route.at(-1))) === 'hole') throw new Error(`${route.at(-1)}번 위치는 H 홀이므로 이동을 끝낼 수 없습니다.`);
    let from = positions.get(route[0]);
    const pack = result.get(from);
    if (!pack) throw new Error(`${index + 1}번째 경로의 출발 위치 ${route[0]}번에 팩이 없습니다.`);
    for (let i = 1; i < route.length; i++) {
      const to = positions.get(route[i]);
      const start = from.split(',').map(Number), end = to.split(',').map(Number);
      for (const cell of cells.filter(cell => ['fixed', 'fixed-circle'].includes(cell.kind))) {
        let enter = 0, leave = 1;
        const levelFrom=start[2]??0,levelTo=end[2]??0;
        if (levelFrom!==levelTo) {
          let lo=0,hi=1;
          const afterDeparture=new Map(result);afterDeparture.delete(from);
          const a=[start[0]*4,baseHeight(start[0],start[1],levelFrom,result)+pack.height/2,start[1]*4],b=[end[0]*4,baseHeight(end[0],end[1],levelTo,afterDeparture)+pack.height/2,end[1]*4];
          const mid=[cell.x*4,baseHeight(cell.x,cell.y,cell.level??0,result)+3,cell.y*4],radius=[2,(6+pack.height)/2,2];
          for(let j=0;j<3;j++){const d=b[j]-a[j];if(!d){if(Math.abs(a[j]-mid[j])>=radius[j])hi=-1;}else{const t1=(mid[j]-radius[j]-a[j])/d,t2=(mid[j]+radius[j]-a[j])/d;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));}}
          if(lo<hi)throw new Error('층간 이동 구간에 X 고정팩이 있습니다. 우회 경유지를 추가해 주세요.');
          continue;
        }
        if((cell.level??0)!==levelFrom)continue;
        for (const [axis, center] of [[0, cell.x], [1, cell.y]]) {
          const delta = end[axis] - start[axis];
          if (delta === 0) { if (Math.abs(start[axis] - center) >= .5) { leave = -1; break; } }
          else {
            const a = (center - .5 - start[axis]) / delta, b = (center + .5 - start[axis]) / delta;
            enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b));
          }
        }
        if (enter < leave) throw new Error('이동 구간에 X 고정팩이 있습니다. 경유 위치를 추가해 우회해 주세요.');
      }
      if (from !== to && result.has(to)) throw new Error(`${index + 1}번째 경로의 ${route[i]}번 위치에 다른 팩이 있습니다.`);
      steps.push({ from, to, pack, route: index, fromNumber: route[i - 1], toNumber: route[i] });
      result.delete(from); result.set(to, pack); from = to;
    }
  }
  return { routes, steps, result };
}
