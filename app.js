import { numberCells } from './numbering.mjs';

const board = document.querySelector('#board');
const toggle = document.querySelector('#toggle');
const status = document.querySelector('#status');
const instruction = document.querySelector('#instruction');
const selected = new Map();
let drawing = true;

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
    cell.textContent = active ? numbers.get(key) : '';
    cell.setAttribute('aria-pressed', String(active));
    cell.setAttribute('aria-label', `${Number(cell.dataset.y) + 1}행 ${Number(cell.dataset.x) + 1}열${active ? `, ${numbers.get(key)}번` : ''}`);
    cell.disabled = !drawing;
  }
  board.classList.toggle('finished', !drawing);
  toggle.textContent = drawing ? '파레트 그리기 종료' : '파레트 다시 그리기';
  toggle.setAttribute('aria-pressed', String(drawing));
  status.textContent = `${drawing ? '그리는 중' : '그리기 완료'} · 선택한 칸 ${selected.size}개`;
  instruction.textContent = drawing
    ? '칸을 클릭해 파레트를 그려 보세요. 빈칸도 번호에 포함됩니다.'
    : '파레트가 완성되었습니다. 다시 그리기를 누르면 이어서 그릴 수 있습니다.';
}

board.addEventListener('click', event => {
  const cell = event.target.closest('.cell');
  if (!drawing || !cell) return;
  const x = Number(cell.dataset.x);
  const y = Number(cell.dataset.y);
  selected.set(`${x},${y}`, { x, y });
  render();
});
toggle.addEventListener('click', () => {
  drawing = !drawing;
  render();
});
