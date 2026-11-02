import { packs } from './packs.mjs';
import { parsePackLabel } from './pack-labels.mjs';

function readList(text, name) {
  const matches = [...text.matchAll(new RegExp(`\\b${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`, 'g'))];
  if (matches.length !== 1) throw new Error(`${name}=[...] 목록을 하나씩 입력해 주세요.`);
  const groups = matches[0][1].replace(/\r/g, '').trim().split(/\n[ \t]*\n+/);
  if (groups.length > 3) throw new Error('최대 3층까지 만들 수 있습니다. 층 사이에만 빈 줄을 넣어 주세요.');
  return groups.map((group, level) => {
    const rows = group.trim().split('\n').map(row => {
      const tokens = row.trim().replace(/,\s*$/, '').split(',').map(token => token.trim());
      if (tokens.length > 40 || !tokens.length) throw new Error(`${name} ${level + 1}층의 가로는 1~40칸이어야 합니다.`);
      return tokens.map(token => {
        token = token.replace(/^(['"])(.*)\1$/, '$2');
        if (token === 'X' || token === 'H') return token;
        try { return parsePackLabel(token); }
        catch { throw new Error(`읽을 수 없는 값 '${token}'입니다. 숫자, X, H 또는 ○ △ □ ◇를 입력해 주세요.`); }
      });
    });
    if (rows.length > 40 || rows.some(row => row.length !== rows[0].length)) throw new Error(`${name} ${level + 1}층은 행마다 같은 칸 수로, 세로 40칸 이하로 입력해 주세요.`);
    return rows;
  });
}

export function importMaps(text) {
  if (text.length > 1000000) throw new Error('입력 내용이 너무 큽니다.');
  const p = readList(text, 'p'), e = readList(text, 'e');
  if (p.length !== e.length) throw new Error('p와 e의 층 수가 다릅니다.');
  const layers = [null, null, null], placements = new Map(), destination = new Map();
  const queues = new Map(), targets = [];
  const type = packs.find(pack => pack.id === 'square-1');
  p.forEach((rows, level) => {
    if (rows.length !== e[level].length || rows[0].length !== e[level][0].length) throw new Error(`${level + 1}층의 p와 e 크기가 다릅니다.`);
    const cells = new Map(); layers[level] = cells;
    rows.forEach((row, y) => row.forEach((value, x) => {
      const end = e[level][y][x], key = `${x},${y},${level}`;
      const specials = [value, end].filter(v => v === 'H' || v === 'X');
      if (specials.length) {
        if (specials.some(v => v !== specials[0]) || [value,end].some(v => v !== 0 && v !== specials[0])) throw new Error(`${level + 1}층 ${y + 1}행 ${x + 1}열의 X/H 표시가 충돌하거나 팩과 겹칩니다.`);
        cells.set(`${x},${y}`, { x, y, kind: specials[0] === 'H' ? 'hole' : 'fixed' });
        return;
      }
      cells.set(`${x},${y}`, { x, y });
      if (value !== 0) {
        const pack = { ...type, number: value };
        placements.set(key, pack);
        if (!queues.has(value)) queues.set(value, []);
        queues.get(value).push(pack);
      }
      if (end !== 0) targets.push([key,end]);
    }));
  });
  for (const [key,label] of targets) {
    const pack = queues.get(label)?.shift();
    if (!pack) throw new Error(`도착맵의 '${label}' 팩이 시작맵 수량보다 많습니다.`);
    destination.set(key, pack);
  }
  if ([...queues.values()].some(queue => queue.length)) throw new Error('시작맵과 도착맵의 팩 번호별 수량이 다릅니다.');
  return { layers, placements, destination, activeLayer: 0, mode: 'idle', showingDestination: false,
    placementComplete: placements.size > 0, numberingComplete: placements.size > 0,
    chosenPack: type, routeText: '', numberDraft: null };
}
