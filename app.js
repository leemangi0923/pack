import { numberCells } from './numbering.mjs';
import { packs, packPreview } from './packs.mjs';
import { nextPackKey } from './pack-order.mjs';
import { parsePackLabel, symbolLabels } from './pack-labels.mjs';
import { prepareRoutes } from './routes.mjs';
import { createRoutePlayer } from './route-player.mjs';
import { SAVE_KEY, encodeWorkspace, decodeWorkspace } from './autosave.mjs';

const board = document.querySelector('#board');
const toggle = document.querySelector('#toggle');
const status = document.querySelector('#status');
const instruction = document.querySelector('#instruction');
const startMap = document.querySelector('#start-map');
const numberPacks = document.querySelector('#number-packs');
const destinationButton = document.querySelector('#destination-map');
const destinationNumbers = document.querySelector('#destination-numbers');
const viewStart = document.querySelector('#view-start');
const packPanel = document.querySelector('#pack-panel');
const packOptions = document.querySelector('#pack-options');
const feedback = document.querySelector('#feedback');
const dialog = document.querySelector('#number-dialog');
const input = document.querySelector('#pack-number');
const numberError = document.querySelector('#number-error');
const selected = new Map();
selected.set('5,3', { x: 5, y: 3 });
const placements = new Map();
const destination = new Map();
let mode = 'drawing';
let showingDestination = false;
let placementComplete = false;
let numberingComplete = false;
let chosenPack = packs[0];
let editingPack = null;
let editingKey = null;
const view3DButton = document.querySelector('#view-3d');
const threeContainer = document.querySelector('#three-view');
let showing3D = false;
let threeView = null;
let threeLoading = false;
const addRoute = document.querySelector('#add-route');
const routePanel = document.querySelector('#route-panel');
const routeInput = document.querySelector('#route-input');
const routeProgress = document.querySelector('#route-progress');
const pauseRoute = document.querySelector('#route-pause');
let routeOpen = false;
let playbackMap = null;
let routePlan = null;
let routeFinished = false;
const saveStatus = document.querySelector('#save-status');
let saveTimer = null;
let lastSaved = null;

function workspaceText() {
  return encodeWorkspace({
    selected, placements, destination, mode, showingDestination, placementComplete,
    numberingComplete, chosenPack, routeText: routeInput.value,
    numberDraft: editingKey === null ? null : { key: editingKey, value: input.value },
  });
}
function saveWorkspace() {
  clearTimeout(saveTimer);
  try {
    const text = workspaceText();
    if (text !== lastSaved) { localStorage.setItem(SAVE_KEY, text); lastSaved = text; }
    saveStatus.textContent = '자동 저장됨';
    saveStatus.title = '이 기기의 현재 브라우저에 저장됩니다.';
    saveStatus.dataset.error = 'false';
  } catch {
    saveStatus.textContent = '자동 저장 실패';
    saveStatus.title = '브라우저 저장 공간이 부족하거나 차단되어 있습니다. 현재 작업은 이 화면에서 계속할 수 있습니다.';
    saveStatus.dataset.error = 'true';
  }
}
function scheduleSave() {
  clearTimeout(saveTimer);
  if (workspaceText() !== lastSaved) saveStatus.textContent = '자동 저장 중…';
  saveTimer = setTimeout(saveWorkspace, 200);
}
function restoreWorkspace() {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    if (text === null) return;
    let restored;
    try { restored = decodeWorkspace(text); }
    catch {
      localStorage.setItem(`${SAVE_KEY}.backup`, text);
      message('저장 데이터를 복원하지 못했습니다. 기존 데이터는 브라우저에 백업하고 새 작업을 시작합니다.');
      return;
    }
    for (const [target, source] of [[selected, restored.selected], [placements, restored.placements], [destination, restored.destination]]) {
      target.clear(); for (const [key, value] of source) target.set(key, value);
    }
    mode = restored.mode; showingDestination = restored.showingDestination;
    placementComplete = restored.placementComplete; numberingComplete = restored.numberingComplete;
    chosenPack = restored.chosenPack; routeInput.value = restored.routeText;
    if (restored.numberDraft) {
      editingKey = restored.numberDraft.key; editingPack = currentMap().get(editingKey);
      input.value = restored.numberDraft.value;
      document.querySelector('#number-title').textContent = `${editingPack.name} 번호`;
      const [x, y] = editingKey.split(',').map(Number);
      document.querySelector('#number-position').textContent = `${y + 1}행 ${x + 1}열 · 저장하면 다음 팩으로 이동`;
    }
    lastSaved = text;
    saveStatus.textContent = '자동 저장 복원됨';
  } catch {
    saveStatus.textContent = '자동 저장 사용 불가'; saveStatus.dataset.error = 'true';
  }
}
const routePlayer = createRoutePlayer({
  onFrame(step, progress, index) {
    const [fx, fy] = step.from.split(',').map(Number);
    const [tx, ty] = step.to.split(',').map(Number);
    const marker = board.querySelector(`[data-x="${fx}"][data-y="${fy}"] .pack-marker`);
    marker?.parentElement.classList.toggle('moving-from', step.from !== step.to && progress > 0);
    const cellSize = parseFloat(board.style.getPropertyValue('--cell-size'));
    if (marker) {
      marker.style.transform = `translate(${(tx - fx) * cellSize * progress}px, ${(ty - fy) * cellSize * progress}px)`;
      marker.style.zIndex = '3';
    }
    if (showing3D) threeView?.movePack(step.from, step.to, progress);
    routeProgress.textContent = `경로 ${step.route + 1}/${routePlan.routes.length} · ${step.fromNumber} → ${step.toNumber} · 이동 ${index + 1}/${routePlan.steps.length}`;
  },
  onStep(step) {
    playbackMap.delete(step.from); playbackMap.set(step.to, step.pack);
    render();
  },
  onComplete() {
    routeFinished = true;
    pauseRoute.disabled = true;
    const matches = destination.size && destination.size === playbackMap.size && [...destination].every(([key, pack]) => playbackMap.get(key) === pack);
    routeProgress.textContent = `모든 경로 이동 완료${destination.size ? matches ? ' · 도착맵과 일치합니다.' : ' · 결과가 도착맵과 다릅니다.' : ''}`;
  },
  onState(running) {
    pauseRoute.disabled = !routePlan || routeFinished;
    pauseRoute.textContent = running ? '일시정지' : '이어서 재생';
    routeInput.disabled = running;
  },
});

function closeRoutes() {
  routePlayer.reset();
  routeOpen = false; playbackMap = null; routePlan = null; routeFinished = false;
  routeInput.disabled = false; pauseRoute.disabled = true;
  routeProgress.textContent = '시작맵에서 재생합니다. 시작맵·도착맵 원본은 유지됩니다.';
}
addRoute.addEventListener('click', () => {
  if (routeOpen) closeRoutes();
  else { routeOpen = true; showingDestination = false; playbackMap = new Map(placements); }
  message(''); render();
});
document.querySelector('#route-play').addEventListener('click', () => {
  try {
    const plan = prepareRoutes(routeInput.value, [...selected.values()], placements);
    routePlayer.reset(); routePlan = plan; routeFinished = false; playbackMap = new Map(placements);
    message(''); render(); routePlayer.load(plan.steps); routePlayer.play();
  } catch (error) { message(error.message); }
});
pauseRoute.addEventListener('click', () => {
  if (routePlayer.running) routePlayer.pause(); else routePlayer.play();
});
document.querySelector('#route-reset').addEventListener('click', () => {
  routePlayer.reset(); routePlan = null; routeFinished = false; playbackMap = new Map(placements);
  pauseRoute.disabled = true; routeInput.disabled = false;
  routeProgress.textContent = '시작 위치로 돌아왔습니다. 입력 완료 · 재생을 눌러 다시 시작하세요.';
  render();
});
document.querySelector('#route-close').addEventListener('click', () => { closeRoutes(); render(); });

function openNumberPanel(key) {
  editingKey = key;
  editingPack = currentMap().get(key);
  input.value = editingPack.number ?? '';
  numberError.textContent = '';
  document.querySelector('#number-title').textContent = `${editingPack.name} 번호`;
  const [x, y] = key.split(',').map(Number);
  document.querySelector('#number-position').textContent = `${y + 1}행 ${x + 1}열 · 저장하면 다음 팩으로 이동`;
  render();
  input.focus();
  input.select();
}

function closeNumberPanel() {
  const previousKey = editingKey;
  editingKey = null;
  editingPack = null;
  render();
  if (previousKey) {
    const [x, y] = previousKey.split(',');
    board.querySelector(`[data-x="${x}"][data-y="${y}"]`).focus();
  }
}

function advanceNumberPanel() {
  const nextKey = nextPackKey(currentMap().keys(), editingKey);
  if (nextKey) openNumberPanel(nextKey);
  else {
    closeNumberPanel();
    message('마지막 팩까지 번호를 저장했습니다. 번호 매기기 완료 버튼을 눌러 주세요.');
  }
}

function fitBoard() {
  const cells = [...selected.values()];
  const drawing = mode === 'drawing';
  const padding = drawing ? 2 : 0;
  const minX = cells.length ? Math.max(0, Math.min(...cells.map(cell => cell.x)) - padding) : 0;
  const minY = cells.length ? Math.max(0, Math.min(...cells.map(cell => cell.y)) - padding) : 0;
  const maxX = cells.length ? Math.min(39, Math.max(...cells.map(cell => cell.x)) + padding) : 11;
  const maxY = cells.length ? Math.min(39, Math.max(...cells.map(cell => cell.y)) + padding) : 7;
  const columns = Math.max(drawing ? 12 : 1, maxX - minX + 1);
  const rows = Math.max(drawing ? 8 : 1, maxY - minY + 1);
  const left = Math.min(minX, 40 - columns);
  const top = Math.min(minY, 40 - rows);
  const viewport = document.querySelector('.viewport');
  const size = Math.max(1, Math.min(80, (viewport.clientWidth - 16) / columns, (viewport.clientHeight - 16) / rows));
  board.style.setProperty('--cell-size', `${size}px`);
  board.style.gridTemplateColumns = `repeat(${columns}, var(--cell-size))`;
  board.style.width = `${size * columns}px`;
  board.style.height = `${size * rows}px`;
  for (const cell of board.children) {
    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    cell.hidden = x < left || x >= left + columns || y < top || y >= top + rows;
  }
}

function message(text) { feedback.textContent = text; }
function currentMap() { return routeOpen && playbackMap ? playbackMap : showingDestination ? destination : placements; }
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
  const numbering = mode === 'numbering' || mode === 'destination-numbering';
  if (routeOpen && (mode !== 'idle' || showingDestination)) closeRoutes();
  routePanel.hidden = !routeOpen;
  addRoute.hidden = mode !== 'idle' || !placementComplete;
  addRoute.textContent = routeOpen ? '경로 닫기' : '경로 추가하기';
  if (mode !== 'idle') showing3D = false;
  view3DButton.hidden = mode !== 'idle' || selected.size === 0;
  view3DButton.textContent = showing3D ? '2D로 보기' : '3D로 보기';
  view3DButton.setAttribute('aria-pressed', String(showing3D));
  threeContainer.hidden = !showing3D;
  board.hidden = showing3D;
  threeView?.setVisible(showing3D);
  if (!numbering) { editingKey = null; editingPack = null; }
  dialog.hidden = !numbering || editingKey === null;
  const map = currentMap();
  const numbers = numberCells([...selected.values()]);
  for (const cell of board.children) {
    const key = `${cell.dataset.x},${cell.dataset.y}`;
    const active = selected.has(key);
    const pack = map.get(key);
    cell.classList.toggle('selected', active);
    cell.classList.toggle('occupied', Boolean(pack));
    cell.classList.remove('moving-from');
    cell.classList.toggle('numbering-current', !dialog.hidden && key === editingKey);
    cell.textContent = '';
    if (active) {
      const number = document.createElement('span');
      number.className = 'cell-number';
      number.textContent = numbers.get(key);
      number.style.setProperty('--number-size', Math.min(0.52, 1.45 / String(numbers.get(key)).length));
      number.style.setProperty('--corner-size', Math.min(0.24, 0.9 / String(numbers.get(key)).length));
      cell.append(number);
      if (pack) {
        const marker = document.createElement('span');
        marker.className = `pack-marker ${pack.shape}`;
        const label = document.createElement('span');
        label.textContent = pack.number ?? pack.size;
        label.style.setProperty('--pack-label-size', Math.min(0.34, 0.7 / String(pack.number ?? pack.size).length));
        const size = document.createElement('small');
        size.textContent = pack.number === null ? '' : pack.size;
        marker.append(label, size);
        marker.title = `${pack.name} · 높이 ${pack.height}cm${pack.number === null ? '' : ` · ${pack.number}번`}`;
        cell.append(marker);
      }
    }
    cell.setAttribute('aria-pressed', String(active));
    cell.setAttribute('aria-label', `${Number(cell.dataset.y) + 1}행 ${Number(cell.dataset.x) + 1}열${active ? `, 칸 ${numbers.get(key)}번` : ''}${pack ? `, ${pack.name}, 높이 ${pack.height}cm, 팩 번호 ${pack.number ?? '미지정'}` : ''}`);
    cell.disabled = !drawing && !(active && (mapping || ((mode === 'numbering' || mode === 'destination-numbering') && pack)));
  }
  board.classList.toggle('finished', !drawing);
  toggle.textContent = drawing ? '파레트 그리기 종료' : '파레트 다시 그리기';
  toggle.setAttribute('aria-pressed', String(drawing));
  startMap.hidden = drawing || selected.size === 0;
  startMap.textContent = mode === 'start' ? '시작맵 만들기 종료' : '시작맵 만들기';
  numberPacks.hidden = !placementComplete || drawing || mode === 'start' || showingDestination;
  numberPacks.textContent = mode === 'numbering' ? '팩 번호 매기기 완료' : '팩 번호 매기기';
  destinationButton.hidden = !numberingComplete || drawing || mode === 'start' || mode === 'numbering';
  destinationButton.textContent = mode === 'destination' ? '도착맵 만들기 완료' : '도착맵 만들기';
  destinationNumbers.hidden = !showingDestination || destination.size !== placements.size || mode === 'destination';
  destinationNumbers.textContent = mode === 'destination-numbering' ? '도착맵 팩 번호 매기기 완료' : '도착맵 팩 번호 매기기';
  viewStart.hidden = !showingDestination;
  packPanel.hidden = !mapping;
  const currentStep = routeOpen ? 4 : (showingDestination || mode === 'destination' || mode === 'destination-numbering') ? 3
    : mode === 'numbering' ? 2 : mode === 'start' ? 1 : mode === 'drawing' ? 0
    : numberingComplete ? 2 : placementComplete ? 1 : 0;
  const availableSteps = [true, selected.size > 0 && mode !== 'drawing', placementComplete, numberingComplete, placementComplete];
  for (const button of document.querySelectorAll('#workflow button')) {
    const step = Number(button.dataset.step);
    button.disabled = !availableSteps[step] && step !== currentStep;
    button.classList.toggle('active', step === currentStep);
    button.classList.toggle('complete', step < currentStep);
    if (step === currentStep) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  }
  const activeAction = mode === 'drawing' ? toggle : mode === 'start' ? startMap
    : mode === 'numbering' ? numberPacks : mode === 'destination' ? destinationButton
    : mode === 'destination-numbering' ? destinationNumbers
    : showingDestination ? destinationNumbers : numberingComplete ? destinationButton : placementComplete ? numberPacks : startMap;
  for (const button of document.querySelectorAll('.editor-actions > button')) button.classList.toggle('primary-action', button === activeAction);
  document.querySelector('main').dataset.tool = mapping ? 'packs' : !dialog.hidden ? 'numbers' : routeOpen ? 'routes' : 'none';
  document.querySelector('#pack-panel h2').textContent = showingDestination ? '도착맵 만들기' : '시작맵 만들기';
  for (const option of packOptions.children) {
    option.setAttribute('aria-pressed', String(option.dataset.pack === chosenPack.id));
    option.querySelector('.remaining').textContent = showingDestination
      ? `남은 수량 ${remaining(packs.find(pack => pack.id === option.dataset.pack)).length}개` : '';
  }
  const names = { drawing: '파레트 그리는 중', idle: showingDestination ? '도착맵 보기' : '시작맵 보기', start: '시작맵 배치 중', numbering: '팩 번호 매기는 중', destination: '도착맵 배치 중', 'destination-numbering': '도착맵 팩 번호 매기는 중' };
  status.textContent = `${names[mode]} · 파레트 ${selected.size}칸 · 팩 ${map.size}개`;
  const instructions = {
    drawing: '칸을 클릭해 그리거나 지울 수 있습니다. 빈칸도 번호에 포함됩니다.',
    start: '팩을 골라 배치하세요. 배치를 마치면 팩 번호를 매길 수 있습니다.',
    numbering: '팩을 클릭해 번호를 입력하세요. 같은 번호나 도형을 여러 팩에 사용할 수 있습니다.',
    destination: '시작맵의 팩을 옮겨 배치하세요. 종류·크기별 남은 수량만 사용할 수 있고 번호는 그대로 유지됩니다.',
    'destination-numbering': '팩을 클릭해 같은 종류·크기의 시작맵 번호를 지정하세요. 이미 배치된 번호를 선택하면 두 팩의 번호가 교환됩니다.',
    idle: '시작맵 배치 → 팩 번호 매기기 → 도착맵 만들기 순서로 진행하세요.',
  };
  instruction.textContent = instructions[mode];
  if (showing3D) {
    instruction.textContent = `${showingDestination ? '도착맵' : '시작맵'} 3D 보기 · 사각팩 2×2cm / 원형팩 지름 2cm · 높이 소 4, 중 5, 대 6cm`;
    threeView.setData([...selected.values()], currentMap(), { preserveView: routeOpen });
  }
  fitBoard();
  scheduleSave();
}

view3DButton.addEventListener('click', async () => {
  if (routePlayer.running) routePlayer.pause();
  if (threeLoading) return;
  message('');
  if (showing3D) { showing3D = false; render(); return; }
  if (!threeView) {
    threeLoading = true;
    view3DButton.disabled = true;
    try {
      const { create3DView } = await import('./view3d.js');
      threeView = create3DView(threeContainer);
    } catch {
      message('이 브라우저에서 3D 그래픽을 시작할 수 없습니다. WebGL 지원을 확인해 주세요. 2D 편집은 계속 사용할 수 있습니다.');
      return;
    } finally {
      threeLoading = false;
      view3DButton.disabled = false;
    }
  }
  if (mode !== 'idle') return;
  showing3D = true;
  render();
});
document.querySelector('#three-reset').addEventListener('click', () => threeView?.reset());
document.querySelector('#three-in').addEventListener('click', () => threeView?.zoom(0.8));
document.querySelector('#three-out').addEventListener('click', () => threeView?.zoom(1.25));

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
  } else if ((mode === 'numbering' || mode === 'destination-numbering') && currentMap().has(key)) {
    openNumberPanel(key);
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
destinationNumbers.addEventListener('click', () => {
  mode = mode === 'destination-numbering' ? 'idle' : 'destination-numbering';
  message(''); render();
});
viewStart.addEventListener('click', () => { mode = 'idle'; showingDestination = false; message(''); render(); });

for (const digit of ['1','2','3','4','5','6','7','8','9','지우기','0','←']) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = digit;
  button.addEventListener('click', () => {
    if (digit === '지우기') input.value = '';
    else {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      if (digit === '←') input.setRangeText('', start === end ? Math.max(0, start - 1) : start, end, 'end');
      else if (input.value.length - (end - start) < 6) input.setRangeText(digit, start, end, 'end');
    }
    input.focus();
  });
  document.querySelector('#keypad').append(button);
}
for (const symbol of symbolLabels) {
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = symbol;
  button.addEventListener('click', () => { input.value = symbol; input.focus(); input.select(); });
  document.querySelector('#symbol-keypad').append(button);
}
document.querySelector('#number-form').addEventListener('submit', event => {
  event.preventDefault();
  let number;
  try { number = parsePackLabel(input.value); }
  catch (error) { numberError.textContent = error.message; return; }
  if (mode === 'destination-numbering') {
    const target = editingPack.number === number ? editingPack
      : [...placements.values()].find(pack => pack.id === editingPack.id && pack.number === number);
    if (!target) {
      numberError.textContent = '시작맵에서 같은 종류·크기의 팩에 지정한 번호를 입력해 주세요.';
      return;
    }
    const other = [...destination.entries()].find(([, pack]) => pack === target);
    if (other) destination.set(other[0], editingPack);
    destination.set(editingKey, target);
    advanceNumberPanel(); return;
  }
  editingPack.number = number;
  advanceNumberPanel();
});
document.querySelector('#cancel-number').addEventListener('click', closeNumberPanel);
dialog.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); closeNumberPanel(); }
});
restoreWorkspace();
render();
routeInput.addEventListener('input', scheduleSave);
input.addEventListener('input', scheduleSave);
document.querySelector('#keypad').addEventListener('click', scheduleSave);
document.querySelector('#symbol-keypad').addEventListener('click', scheduleSave);
document.querySelector('#workflow').addEventListener('click', event => {
  const button = event.target.closest('button[data-step]');
  if (!button || button.disabled) return;
  const step = Number(button.dataset.step);
  if (step === 0 && mode !== 'drawing') toggle.click();
  if (step === 1 && mode !== 'start') startMap.click();
  if (step === 2 && mode !== 'numbering') numberPacks.click();
  if (step === 3 && mode !== 'destination' && mode !== 'destination-numbering') destinationButton.click();
  if (step === 4 && !routeOpen) addRoute.click();
});
window.addEventListener('pagehide', saveWorkspace);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveWorkspace(); });
new ResizeObserver(fitBoard).observe(document.querySelector('.viewport'));
