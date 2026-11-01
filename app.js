import { numberCells } from './numbering.mjs';
import { packs, packPreview } from './packs.mjs';

const board = document.querySelector('#board');
const toggle = document.querySelector('#toggle');
const status = document.querySelector('#status');
const instruction = document.querySelector('#instruction');
const startMap = document.querySelector('#start-map');
const numberPacks = document.querySelector('#number-packs');
const destinationButton = document.querySelector('#destination-map');
const viewStart = document.querySelector('#view-start');
const packPanel = document.querySelector('#pack-panel');
const packOptions = document.querySelector('#pack-options');
const feedback = document.querySelector('#feedback');
const dialog = document.querySelector('#number-dialog');
const input = document.querySelector('#pack-number');
const numberError = document.querySelector('#number-error');
const selected = new Map();
const placements = new Map();
const destination = new Map();
let mode = 'drawing';
let showingDestination = false;
let placementComplete = false;
let numberingComplete = false;
let chosenPack = packs[0];
let editingPack = null;

function message(text) { feedback.textContent = text; }
function currentMap() { return showingDestination ? destination : placements; }
function remaining(pack) {
  const used = new Set(destination.values());
  return [...placements.values()].filter(item => item.id === pack.id && !used.has(item));
}
function invalidate() {
  placementComplete = false;
  numberingComplete = false;
  const available = new Set(placements.values());
  for (const [key, item] of destination) {
    if (!selected.has(key) || !available.has(item)) destination.delete(key);
  }
}

for (const pack of packs) {
  const option = document.createElement('button');
  option.type = 'button';
  option.className = 'pack-option';
  option.dataset.pack = pack.id;
  option.innerHTML = `${packPreview(pack)}<strong>${pack.name}</strong><span>${pack.shape === 'square' ? '밑면 2 × 2cm' : '지름 2cm'}</span><span>높이 ${pack.height}cm</span><span class="remaining"></span>`;
  option.addEventListener('click', () => { chosenPack = pack; message(''); render(); });
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
    fragment.append(cell);
  }
}
board.append(fragment);

function render() {
  const drawing = mode === 'drawing';
  const mapping = mode === 'start' || mode === 'destination';
  const map = currentMap();
  const numbers = numberCells([...selected.values()]);
  for (const cell of board.children) {
    const key = `${cell.dataset.x},${cell.dataset.y}`;
    const active = selected.has(key);
    const pack = map.get(key);
    cell.classList.toggle('selected', active);
    cell.classList.toggle('occupied', Boolean(pack));
    cell.textContent = '';
    if (active) {
      const number = document.createElement('span');
      number.className = 'cell-number';
      number.textContent = numbers.get(key);
      cell.append(number);
      if (pack) {
        const marker = document.createElement('span');
        marker.className = `pack-marker ${pack.shape}`;
        const label = document.createElement('span');
        label.textContent = pack.number ?? pack.size;
        const size = document.createElement('small');
        size.textContent = pack.number === null ? '' : pack.size;
        marker.append(label, size);
        marker.title = `${pack.name} · 높이 ${pack.height}cm${pack.number === null ? '' : ` · ${pack.number}번`}`;
        cell.append(marker);
      }
    }
    cell.setAttribute('aria-pressed', String(active));
    cell.setAttribute('aria-label', `${Number(cell.dataset.y) + 1}행 ${Number(cell.dataset.x) + 1}열${active ? `, 칸 ${numbers.get(key)}번` : ''}${pack ? `, ${pack.name}, 높이 ${pack.height}cm, 팩 번호 ${pack.number ?? '미지정'}` : ''}`);
    cell.disabled = !drawing && !(active && (mapping || (mode === 'numbering' && pack)));
  }
  board.classList.toggle('finished', !drawing);
  toggle.textContent = drawing ? '파레트 그리기 종료' : '파레트 다시 그리기';
  toggle.setAttribute('aria-pressed', String(drawing));
  startMap.hidden = drawing || selected.size === 0;
  startMap.textContent = mode === 'start' ? '시작맵 만들기 종료' : '시작맵 만들기';
  numberPacks.hidden = !placementComplete || drawing || mode === 'start';
  numberPacks.textContent = mode === 'numbering' ? '팩 번호 매기기 완료' : '팩 번호 매기기';
  destinationButton.hidden = !numberingComplete || drawing || mode === 'start' || mode === 'numbering';
  destinationButton.textContent = mode === 'destination' ? '도착맵 만들기 완료' : '도착맵 만들기';
  viewStart.hidden = !showingDestination;
  packPanel.hidden = !mapping;
  document.querySelector('#pack-panel h2').textContent = showingDestination ? '도착맵 만들기' : '시작맵 만들기';
  for (const option of packOptions.children) {
    option.setAttribute('aria-pressed', String(option.dataset.pack === chosenPack.id));
    option.querySelector('.remaining').textContent = showingDestination
      ? `남은 수량 ${remaining(packs.find(pack => pack.id === option.dataset.pack)).length}개` : '';
  }
  const names = { drawing: '파레트 그리는 중', idle: showingDestination ? '도착맵 보기' : '시작맵 보기', start: '시작맵 배치 중', numbering: '팩 번호 매기는 중', destination: '도착맵 배치 중' };
  status.textContent = `${names[mode]} · 파레트 ${selected.size}칸 · 팩 ${map.size}개`;
  const instructions = {
    drawing: '칸을 클릭해 그리거나 지울 수 있습니다. 빈칸도 번호에 포함됩니다.',
    start: '팩을 골라 배치하세요. 배치를 마치면 팩 번호를 매길 수 있습니다.',
    numbering: '팩을 클릭해 번호를 입력하세요. 모든 팩에 서로 다른 번호를 지정한 뒤 완료하세요.',
    destination: '시작맵의 팩을 옮겨 배치하세요. 종류·크기별 남은 수량만 사용할 수 있고 번호는 그대로 유지됩니다.',
    idle: '시작맵 배치 → 팩 번호 매기기 → 도착맵 만들기 순서로 진행하세요.',
  };
  instruction.textContent = instructions[mode];
}

board.addEventListener('click', event => {
  const cell = event.target.closest('.cell');
  if (!cell) return;
  const x = Number(cell.dataset.x);
  const y = Number(cell.dataset.y);
  const key = `${x},${y}`;
  message('');
  if (mode === 'drawing') {
    if (selected.has(key)) { selected.delete(key); placements.delete(key); }
    else selected.set(key, { x, y });
    invalidate();
  } else if (mode === 'start' && selected.has(key)) {
    if (placements.get(key)?.id === chosenPack.id) placements.delete(key);
    else placements.set(key, { ...chosenPack, number: null });
    invalidate();
  } else if (mode === 'numbering' && placements.has(key)) {
    editingPack = placements.get(key);
    input.value = editingPack.number ?? '';
    numberError.textContent = '';
    document.querySelector('#number-title').textContent = `${editingPack.name} 번호`;
    dialog.showModal();
    input.focus();
    input.select();
    return;
  } else if (mode === 'destination' && selected.has(key)) {
    if (destination.get(key)?.id === chosenPack.id) destination.delete(key);
    else {
      const item = remaining(chosenPack)[0];
      if (!item) { message(`${chosenPack.name}의 남은 수량이 없습니다. 배치된 팩을 지운 뒤 다시 놓을 수 있습니다.`); return; }
      destination.set(key, item);
    }
  } else return;
  render();
});
toggle.addEventListener('click', () => {
  mode = mode === 'drawing' ? 'idle' : 'drawing';
  showingDestination = false;
  message(''); render();
});
startMap.addEventListener('click', () => {
  message('');
  if (mode === 'start') {
    if (!placements.size) { message('팩을 하나 이상 배치해 주세요.'); return; }
    placementComplete = true;
    mode = 'idle';
  } else { mode = 'start'; placementComplete = false; numberingComplete = false; }
  showingDestination = false;
  render();
});
numberPacks.addEventListener('click', () => {
  message('');
  if (mode === 'numbering') {
    if ([...placements.values()].some(pack => pack.number === null)) {
      message('아직 번호가 없는 팩이 있습니다. 모든 팩에 번호를 지정해 주세요.'); return;
    }
    numberingComplete = true;
    mode = 'idle';
  } else { mode = 'numbering'; numberingComplete = false; }
  showingDestination = false;
  render();
});
destinationButton.addEventListener('click', () => {
  message('');
  if (mode === 'destination') {
    if (destination.size !== placements.size) {
      message(`시작맵의 팩을 모두 배치해 주세요. ${placements.size - destination.size}개 남았습니다.`); return;
    }
    mode = 'idle';
  } else mode = 'destination';
  showingDestination = true;
  render();
});
viewStart.addEventListener('click', () => { mode = 'idle'; showingDestination = false; message(''); render(); });

for (const digit of ['1','2','3','4','5','6','7','8','9','지우기','0','←']) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = digit;
  button.addEventListener('click', () => {
    if (digit === '지우기') input.value = '';
    else if (digit === '←') input.value = input.value.slice(0, -1);
    else if (input.value.length < 6) input.value += digit;
    input.focus();
  });
  document.querySelector('#keypad').append(button);
}
document.querySelector('#number-form').addEventListener('submit', event => {
  event.preventDefault();
  const value = input.value.trim();
  if (!/^\d{1,6}$/.test(value)) { numberError.textContent = '0부터 999999까지의 정수를 입력해 주세요.'; return; }
  const number = Number(value);
  if ([...placements.values()].some(pack => pack !== editingPack && pack.number === number)) {
    numberError.textContent = '이미 사용 중인 번호입니다. 다른 번호를 입력해 주세요.'; return;
  }
  editingPack.number = number;
  dialog.close();
  render();
});
document.querySelector('#cancel-number').addEventListener('click', () => dialog.close());
render();
