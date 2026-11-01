import { numberCells } from './numbering.mjs';
import { packs, packPreview } from './packs.mjs';

const board = document.querySelector('#board');
const toggle = document.querySelector('#toggle');
const status = document.querySelector('#status');
const instruction = document.querySelector('#instruction');
const selected = new Map();
const placements = new Map();
const startMap = document.querySelector('#start-map');
const packPanel = document.querySelector('#pack-panel');
const packOptions = document.querySelector('#pack-options');
let mapping = false;
let chosenPack = packs[0];
let drawing = true;

for (const pack of packs) {
  const option = document.createElement('button');
  option.type = 'button';
  option.className = 'pack-option';
  option.dataset.pack = pack.id;
  option.setAttribute('aria-pressed', String(pack === chosenPack));
  option.innerHTML = `${packPreview(pack)}<strong>${pack.name}</strong><span>${pack.shape === 'square' ? '밑면 2 × 2cm' : '지름 2cm'}</span><span>높이 ${pack.height}cm</span>`;
  option.addEventListener('click', () => {
    chosenPack = pack;
    for (const button of packOptions.children) {
      button.setAttribute('aria-pressed', String(button === option));
    }
  });
  packOptions.append(option);
}

const fragment = document.createDocumentFragment();
for (let y = 0; y < 40; y++) {
  for (let x = 0; x < 40; x++) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    cell.dataset.x = x;
    cell.dataset.y = y;
    cell.setAttribute('aria-label', `${y + 1}행 ${x + 1}열`);
    cell.setAttribute('aria-pressed', 'false');
    fragment.append(cell);
  }
}
board.append(fragment);

function render() {
  const numbers = numberCells([...selected.values()]);
  for (const cell of board.children) {
    const key = `${cell.dataset.x},${cell.dataset.y}`;
    const active = selected.has(key);
    cell.classList.toggle('selected', active);
    cell.textContent = '';
    if (active) {
      const number = document.createElement('span');
      number.className = 'cell-number';
      number.textContent = numbers.get(key);
      cell.append(number);
      const pack = placements.get(key);
      if (pack) {
        const marker = document.createElement('span');
        marker.className = `pack-marker ${pack.shape}`;
        marker.textContent = pack.size;
        marker.title = `${pack.name} · 높이 ${pack.height}cm`;
        cell.append(marker);
      }
    }
    cell.classList.toggle('occupied', placements.has(key));
    cell.setAttribute('aria-pressed', String(active));
    cell.setAttribute('aria-label', `${Number(cell.dataset.y) + 1}행 ${Number(cell.dataset.x) + 1}열${active ? `, ${numbers.get(key)}번` : ''}${placements.has(key) ? `, ${placements.get(key).name}, 높이 ${placements.get(key).height}cm` : ''}`);
    cell.disabled = !drawing && !(mapping && active);
  }
  board.classList.toggle('finished', !drawing);
  toggle.textContent = drawing ? '파레트 그리기 종료' : '파레트 다시 그리기';
  toggle.setAttribute('aria-pressed', String(drawing));
  startMap.hidden = drawing || selected.size === 0;
  startMap.textContent = mapping ? '시작맵 만들기 종료' : '시작맵 만들기';
  packPanel.hidden = !mapping;
  status.textContent = `${drawing ? '그리는 중' : mapping ? '시작맵 배치 중' : '그리기 완료'} · 선택한 칸 ${selected.size}개 · 배치한 팩 ${placements.size}개`;
  instruction.textContent = drawing
    ? '칸을 클릭해 그리거나 지울 수 있습니다. 빈칸도 번호에 포함됩니다.'
    : mapping ? '팩을 선택하고 파레트 칸을 클릭해 시작맵을 만드세요.'
    : '파레트가 완성되었습니다. 시작맵 만들기로 팩을 배치할 수 있습니다.';
}

board.addEventListener('click', event => {
  const cell = event.target.closest('.cell');
  if (!cell) return;
  const x = Number(cell.dataset.x);
  const y = Number(cell.dataset.y);
  const key = `${x},${y}`;
  if (drawing) {
    if (selected.has(key)) {
      selected.delete(key);
      placements.delete(key);
    } else selected.set(key, { x, y });
  } else if (mapping && selected.has(key)) {
    if (placements.get(key)?.id === chosenPack.id) placements.delete(key);
    else placements.set(key, chosenPack);
  } else return;
  render();
});
toggle.addEventListener('click', () => {
  drawing = !drawing;
  mapping = false;
  render();
});
startMap.addEventListener('click', () => {
  if (drawing || selected.size === 0) return;
  mapping = !mapping;
  render();
});
