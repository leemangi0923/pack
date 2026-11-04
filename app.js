import { motionDuration } from './motion-timing.mjs';
import { poseOf, footprint, uniquePacks, normalizeLayouts, changePackType } from './lying-packs.mjs';
import { swapFloors, swapFloorKey } from './swap-floors.mjs';
import { numberCells, layerOffsets } from './numbering.mjs';
import { packs, packPreview } from './packs.mjs';
import { nextPackKey } from './pack-order.mjs';
import { parsePackLabel, symbolLabels } from './pack-labels.mjs';
import { prepareRoutes, routeState } from './routes.mjs';
import { createRoutePlayer } from './route-player.mjs';
import { SAVE_KEY } from './autosave.mjs';
import { encodeUnified, decodeUnified, placeKey } from './unified-workspace.mjs';
import { importMaps } from './map-import.mjs';
import { layerElevations } from './scene-model.mjs';

const boards = document.querySelector('#boards');
const floorBoards = [...document.querySelectorAll('.layer-board')];
let board = floorBoards[0];
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
const previousStep = document.querySelector('#route-previous');
const nextStep = document.querySelector('#route-next');
let routePlanText = '';
let transitPack = null;
let secondsPerCell = 1;
try {const value=Number(localStorage.getItem('pack.seconds-per-cell'));if(value>=.1&&value<=10)secondsPerCell=value;}catch{}
let collisionMode = 'stop';
try { const saved = localStorage.getItem('pack.route-settings.v1'); if (saved === 'climb') collisionMode = saved; } catch {}
let routeOpen = false;
let playbackMap = null;
let routePlan = null;
let routeFinished = false;
let dragStroke = null;
let suppressDragClick = false;
let cellKind = 'normal';
const cellTools = document.querySelector('#cell-tools');
cellTools.addEventListener('click', event => {
  const button = event.target.closest('button[data-kind]');
  if (!button) return;
  cellKind = button.dataset.kind;
  for (const option of cellTools.querySelectorAll('button')) option.setAttribute('aria-pressed', String(option === button));
});
const saveStatus = document.querySelector('#save-status');
let saveTimer = null;
let lastSaved = null;
let initialWorkspaceText = null;
let previousWorkspaceText = null;
let workStarted = false;
const loadPrevious = document.querySelector('#load-previous');
const importDialog = document.querySelector('#import-dialog');
document.querySelector('#open-import').addEventListener('click', () => {
  routePlayer.pause();
  document.querySelector('#import-error').textContent = '';
  importDialog.showModal();
});
document.querySelector('#cancel-import').addEventListener('click', () => importDialog.close());
document.querySelector('#import-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const state = importMaps(document.querySelector('#import-text').value);
    const routeText = document.querySelector('#import-route').value.trim();
    if (routeText) prepareRoutes(routeText, state.layers.flatMap((layer,level)=>layer?[...layer.values()].map(cell=>({...cell,level})):[]), state.placements, 0, collisionMode);
    state.routeText = routeText;
    restoreWorkspace(encodeUnified(state));
    message('목록으로 시작맵·도착맵을 만들었습니다. 팩 종류는 ‘팩 바꾸기’로 번호를 유지하며 수정할 수 있습니다.');
    importDialog.close();
    if (event.submitter?.dataset.openRoute) { routeOpen = true; playbackMap = new Map(placements); render(); routeInput.focus(); }
  } catch (error) { document.querySelector('#import-error').textContent = error.message; }
});
let replacePacks = false;
const replaceButton = document.querySelector('#replace-packs');
replaceButton.addEventListener('click', () => {
  replacePacks = !replacePacks;
  cellKind = 'normal';
  if (replacePacks) mode = 'replace';
  else mode = 'idle';
  render();
});
let activeLayer = 0;
let layerSnapshots = [null, null, null];
function allLayers() {
  return layerSnapshots.map((layer,index)=>index===activeLayer?selected:layer);
}
function layerCells() { return allLayers().map(layer=>layer?[...layer.values()]:[]); }
function allCells() { return layerCells().flatMap((cells,level)=>cells.map(cell=>({...cell,level}))); }
function localPacks(map,level) { return new Map([...map].filter(([key])=>Number(key.split(',')[2])===level).map(([key,p])=>[key.split(',').slice(0,2).join(','),p])); }
function showLayer(next) {
  finishStroke(); layerSnapshots[activeLayer]=new Map(selected); activeLayer=next; board=floorBoards[next];
  let layer=layerSnapshots[next];
  if(!layer){
    layer=new Map([...(layerSnapshots[next-1]??selected)].map(([key,{x,y}])=>[key,{x,y}]));
    layerSnapshots[next]=layer;
  }
  selected.clear();for(const[k,c]of layer)selected.set(k,{...c});
}
function workspaceText() {
 return encodeUnified({activeLayer,layers:allLayers(),placements,destination,mode,showingDestination,
  placementComplete,numberingComplete,chosenPack,routeText:routeInput.value,
  numberDraft:editingKey===null?null:{key:editingKey,value:input.value}});
}
document.querySelector('#layer-tabs').addEventListener('click',event=>{
 const button=event.target.closest('button[data-layer]');if(!button||button.disabled)return;
 const next=Number(button.dataset.layer);if(next===activeLayer)return;
 showLayer(next);editingKey=null;editingPack=null;cellKind='normal';message('');render();
});
document.querySelector('#swap-floors').addEventListener('click', () => {
  finishStroke();
  const state = swapFloors({ layers: allLayers(), placements, destination, activeLayer, routeText: routeInput.value });
  const wasRouteOpen = routeOpen;
  closeRoutes();
  layerSnapshots = state.layers; activeLayer = state.activeLayer; board = floorBoards[activeLayer];
  selected.clear(); for (const [key,cell] of state.layers[activeLayer]) selected.set(key,cell);
  placements.clear(); for (const [key,pack] of state.placements) placements.set(key,pack);
  destination.clear(); for (const [key,pack] of state.destination) destination.set(key,pack);
  routeInput.value = state.routeText;
  if (editingKey) {
    editingKey = swapFloorKey(editingKey);
    const [x,y,level] = editingKey.split(',').map(Number);
    document.querySelector('#number-position').textContent = `${level+1}층 · ${y+1}행 ${x+1}열 · 저장하면 다음 팩으로 이동`;
  }
  if (wasRouteOpen) { routeOpen = true; playbackMap = new Map(placements); }
  message(`1층과 2층을 바꿨습니다.${state.warning ? ` ${state.warning}` : ' 경로 번호도 새 위치에 맞췄습니다.'}`);
  render();
});
function saveWorkspace() {
  clearTimeout(saveTimer);
  if (!workStarted) return;
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
  if (!workStarted) {
    if (workspaceText() === initialWorkspaceText) return;
    workStarted = true;
  }
  if (workspaceText() !== lastSaved) saveStatus.textContent = '자동 저장 중…';
  saveTimer = setTimeout(saveWorkspace, 200);
}
function restoreWorkspace(text) {
  try {
    if (text === null) { message('불러올 저장 내용이 없습니다.'); return; }
    let restored;
    try { restored=decodeUnified(text); }
    catch {localStorage.setItem(`${SAVE_KEY}.backup`,text);message('저장 데이터를 복원하지 못했습니다. 기존 데이터는 백업했습니다.');return;}
    clearTimeout(saveTimer);
    closeRoutes(); showing3D = false; editingKey = null; editingPack = null;
    activeLayer=restored.activeLayer;board=floorBoards[activeLayer];layerSnapshots=restored.layers;
    selected.clear();for(const[k,c]of restored.layers[activeLayer])selected.set(k,c);
    placements.clear();for(const[k,p]of restored.placements)placements.set(k,p);
    destination.clear();for(const[k,p]of restored.destination)destination.set(k,p);
    mode=restored.mode;showingDestination=restored.showingDestination;
    placementComplete=restored.placementComplete;numberingComplete=restored.numberingComplete;
    chosenPack=restored.chosenPack;routeInput.value=restored.routeText;
    if(restored.numberDraft){
      editingKey=restored.numberDraft.key;editingPack=currentMap().get(editingKey);input.value=restored.numberDraft.value;
      document.querySelector('#number-title').textContent=`${editingPack.name} 번호`;
      const [x,y,level]=editingKey.split(',').map(Number);
      document.querySelector('#number-position').textContent=`${level+1}층 · ${y+1}행 ${x+1}열 · 저장하면 다음 팩으로 이동`;
    }
    lastSaved = text;
    workStarted = true;
    saveStatus.textContent = '자동 저장 복원됨';
    saveStatus.dataset.error = 'false';
    message('이전 작업을 불러왔습니다.');
    render();
  } catch {
    saveStatus.textContent = '자동 저장 사용 불가'; saveStatus.dataset.error = 'true';
  }
}
const routePlayer = createRoutePlayer({
  getDuration: step=>motionDuration(step,secondsPerCell),
  getDelay: (last,next)=>last.route!==next.route?500:0,
  onWait: remaining=>{routeProgress.textContent=`다음 팩 이동 준비 · ${(remaining/1000).toFixed(1)}초`;},
  onSeek(count, steps) {
    const state = routeState(placements,steps,count); playbackMap = state.map; transitPack = state.traveller;
    routeFinished = count === steps.length && count > 0;
    if (!showing3D && steps.length) showLayer(Number((count ? steps[count-1].to : steps[0].from).split(',')[2]));
    render();
    const step = steps[count-1];
    routeProgress.textContent = count ? `이동 ${count}/${steps.length} · 경로 ${step.route+1} · ${step.fromNumber} → ${step.toNumber}` : `시작 상태 · 이동 0/${steps.length}`;
  },
  onFrame(step, progress, index) {
    const [fx, fy, fl] = step.from.split(',').map(Number);
    const tl=Number(step.to.split(',')[2]);
    if (!showing3D && activeLayer!==fl) { showLayer(fl);render(); }
    const [tx, ty] = step.to.split(',').map(Number);
    const sourceCell = board.querySelector(`[data-x="${fx}"][data-y="${fy}"]`);
    const marker = sourceCell?.querySelector('.pack-marker.traveller') ?? sourceCell?.querySelector('.pack-marker');
    marker?.parentElement.classList.toggle('moving-from', step.from !== step.to && progress > 0);
    const cellSize = parseFloat(board.style.getPropertyValue('--cell-size'));
    if (marker && activeLayer===fl) {
      marker.style.transform = `translate(${(tx - fx) * cellSize * progress}px, ${(ty - fy) * cellSize * progress}px)`;
      marker.style.zIndex = '3';
      marker.style.opacity=fl===tl?'1':String(1-progress*.7);
      marker.classList.toggle('passing-over',!!step.over);
    }
    if (showing3D) threeView?.movePack(step.from, step.to, progress, step);
    routeProgress.textContent = `경로 ${step.route + 1}/${routePlan.routes.length} · ${step.fromNumber} → ${step.toNumber} · 이동 ${index + 1}/${routePlan.steps.length}`;
  },
  onStep(step, index) {
    const state = routeState(placements,routePlan.steps,index+1); playbackMap = state.map; transitPack = state.traveller;
    if(!showing3D)showLayer(Number(step.to.split(',')[2]));
    render();
  },
  onComplete() {
    routeFinished = true;
    pauseRoute.disabled = true;
    const matches = destination.size && destination.size === playbackMap.size && [...destination].every(([key, pack]) => playbackMap.get(key) === pack);
    routeProgress.textContent = `모든 경로 이동 완료 · 이동 ${routePlan.steps.length}/${routePlan.steps.length}${destination.size ? matches ? ' · 도착맵과 일치합니다.' : ' · 결과가 도착맵과 다릅니다.' : ''}`;
  },
  onState(running) {
    document.querySelector('#route-position').max = routePlayer.length;
    document.querySelector('#route-position').value = routePlayer.position;
    document.querySelector('#route-position').disabled = !routePlan || routePlayer.length === 0;
    document.querySelector('#route-count').textContent = `${routePlayer.position} / ${routePlayer.length}`;
    previousStep.disabled = !routePlan || (routePlayer.position === 0 && routePlayer.progress === 0 && !running);
    nextStep.disabled = !!routePlan && routePlayer.position >= routePlayer.length;
    if (running && routePlayer.stepping) { previousStep.disabled = true; nextStep.disabled = true; }
    pauseRoute.disabled = !routePlan || (routeFinished && !running);
    pauseRoute.textContent = running ? '일시정지' : '이어서 재생';
    routeInput.disabled = running;
  },
});
const settingsDialog = document.querySelector('#settings-dialog');
const speedInput=document.querySelector('#seconds-per-cell');speedInput.value=secondsPerCell;
speedInput.addEventListener('change',()=>{const value=Number(speedInput.value);if(!Number.isFinite(value)||value<.1||value>10){speedInput.value=secondsPerCell;return;}routePlayer.pause();secondsPerCell=value;try{localStorage.setItem('pack.seconds-per-cell',String(value));}catch{}document.querySelector('#settings-status').textContent=`한 칸당 ${value}초로 적용했습니다.`;});
for (const radio of settingsDialog.querySelectorAll('[name="collision-mode"]')) radio.checked = radio.value === collisionMode;
document.querySelector('#open-settings').addEventListener('click', () => { routePlayer.pause(); settingsDialog.showModal(); });
document.querySelector('#close-settings').addEventListener('click', () => settingsDialog.close());
settingsDialog.addEventListener('change', event => {
  if (event.target.name !== 'collision-mode') return;
  collisionMode = event.target.value;
  routePlayer.reset(); routePlan = null; transitPack = null; routeFinished = false;
  previousStep.disabled = true; nextStep.disabled = false; pauseRoute.disabled = true; routeInput.disabled = false;
  if (routeOpen) playbackMap = new Map(placements);
  message('');
  routeProgress.textContent = '설정이 변경되어 시작 상태로 돌아왔습니다. 재생 또는 다음 버튼으로 다시 확인하세요.';
  try { localStorage.setItem('pack.route-settings.v1', collisionMode); document.querySelector('#settings-status').textContent = '설정을 저장했습니다.'; }
  catch { document.querySelector('#settings-status').textContent = '현재 창에 적용했습니다. 브라우저에 저장할 수 없습니다.'; }
  render();
});
document.querySelector('#route-position').addEventListener('input', event => {
  if (routePlan) routePlayer.seek(Number(event.target.value));
});
document.addEventListener('keydown', event => {
  if (!routeOpen || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.repeat || importDialog.open) return;
  if (event.target.closest('input,textarea,select,[contenteditable="true"]') || (event.code === 'Space' && event.target.closest('button'))) return;
  const button = event.key === 'ArrowLeft' ? previousStep : event.key === 'ArrowRight' ? nextStep
    : event.code === 'Space' ? routePlan && !routeFinished ? pauseRoute : document.querySelector('#route-play') : null;
  if (button && !button.disabled) { event.preventDefault(); button.click(); }
});
document.querySelector('#map-tabs').addEventListener('click', event => {
  const button = event.target.closest('button[data-map]');
  if (!button || button.disabled) return;
  closeRoutes(); editingKey = null; editingPack = null;
  mode = 'idle'; showingDestination = button.dataset.map === 'end';
  message(''); render();
});
for (const [button, direction] of [[previousStep, 'animateBack'], [nextStep, 'animateNext']]) {
  button.addEventListener('click', () => {
    try {
      if (!routePlan || routeInput.value !== routePlanText) {
        const plan = prepareRoutes(routeInput.value, allCells(), placements, 0, collisionMode);
        routePlayer.reset(); routePlan = plan; routePlanText = routeInput.value;
        routeFinished = false; transitPack = null; playbackMap = new Map(placements); routePlayer.load(plan.steps);
      }
      message(''); routePlayer[direction]();
    } catch (error) { message(error.message); }
  });
}

function closeRoutes() {
  routePlayer.reset();
  transitPack = null;
  routeOpen = false; playbackMap = null; routePlan = null; routeFinished = false;
  routeInput.disabled = false; pauseRoute.disabled = true;
  previousStep.disabled = true; nextStep.disabled = false;
  routeProgress.textContent = '시작맵에서 재생합니다. 시작맵·도착맵 원본은 유지됩니다.';
}
addRoute.addEventListener('click', () => {
  if (routeOpen) closeRoutes();
  else { routeOpen = true; showingDestination = false; playbackMap = new Map(placements); }
  message(''); render();
});
document.querySelector('#route-play').addEventListener('click', () => {
  try {
    const plan = prepareRoutes(routeInput.value, allCells(), placements, 0, collisionMode);
    routePlayer.reset(); routePlan = plan; routePlanText = routeInput.value; routeFinished = false; transitPack = null; playbackMap = new Map(placements);
    message(''); render(); routePlayer.load(plan.steps); routePlayer.play();
  } catch (error) { message(error.message); }
});
pauseRoute.addEventListener('click', () => {
  if (routePlayer.running) routePlayer.pause(); else routePlayer.play();
});
document.querySelector('#route-reset').addEventListener('click', () => {
  routePlayer.reset(); routePlan = null; routeFinished = false; transitPack = null; playbackMap = new Map(placements);
  pauseRoute.disabled = true; routeInput.disabled = false;
  previousStep.disabled = true; nextStep.disabled = false;
  routeProgress.textContent = '시작 위치로 돌아왔습니다. 입력 완료 · 재생을 눌러 다시 시작하세요.';
  render();
});
document.querySelector('#route-close').addEventListener('click', () => { closeRoutes(); render(); });

function openNumberPanel(key) {
  key=poseOf(currentMap(),key).anchor;
  const level=Number(key.split(',')[2]);if(level!==activeLayer)showLayer(level);
  editingKey = key;
  editingPack = currentMap().get(key);
  input.value = editingPack.number ?? '';
  numberError.textContent = '';
  document.querySelector('#number-title').textContent = `${editingPack.name} 번호`;
  const [x, y] = key.split(',').map(Number);
  document.querySelector('#number-position').textContent = `${activeLayer + 1}층 · ${y + 1}행 ${x + 1}열 · 저장하면 다음 팩으로 이동`;
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
  const map=currentMap();const anchors=[...map.keys()].filter(k=>poseOf(map,k).anchor===k);
  editingKey=poseOf(map,editingKey).anchor;
  const nextKey = nextPackKey(anchors, editingKey);
  if (nextKey) openNumberPanel(nextKey);
  else {
    closeNumberPanel();
    message('마지막 팩까지 번호를 저장했습니다. 번호 매기기 완료 버튼을 눌러 주세요.');
  }
}

function fitBoard() {
  if (dragStroke) return;
  for (const [level, currentBoard] of floorBoards.entries()) {
  const layer=allLayers()[level];if(!layer)continue;
  const cells = [...layer.values()];
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
  const viewport = currentBoard.parentElement;
  const size = Math.max(1, Math.min(80, (viewport.clientWidth - 16) / columns, (viewport.clientHeight - 16) / rows));
  currentBoard.style.setProperty('--cell-size', `${size}px`);
  currentBoard.style.gridTemplateColumns = `repeat(${columns}, var(--cell-size))`;
  currentBoard.style.width = `${size * columns}px`;
  currentBoard.style.height = `${size * rows}px`;
  for (const cell of currentBoard.children) {
    const x = Number(cell.dataset.x);
    const y = Number(cell.dataset.y);
    cell.hidden = x < left || x >= left + columns || y < top || y >= top + rows;
  }
  }
}

function message(text) { feedback.textContent = text; }
function currentMap() { return routeOpen && playbackMap ? playbackMap : showingDestination ? destination : placements; }
function remaining(pack) {
  const used = new Set(destination.values());
  return uniquePacks(placements).filter(item => item.id === pack.id && !used.has(item));
}
function invalidate() {
  placementComplete = false;
  numberingComplete = false;
  const valid=new Set(allCells().filter(c=>!c.kind).map(c=>`${c.x},${c.y},${c.level}`));
  for(const[key]of placements)if(!valid.has(key))placements.delete(key);
  for(const map of [placements,destination])for(const p of uniquePacks(map))if(p.lying&&[...map.values()].filter(v=>v===p).length!==2)for(const[k,v]of map)if(v===p)map.delete(k);
  const available = new Set(placements.values());
  for(const[key,item]of destination)if(!valid.has(key)||!available.has(item))destination.delete(key);
}

for (const pack of packs) {
  const option = document.createElement('button');
  option.type = 'button';
  option.className = 'pack-option';
  option.dataset.pack = pack.id;
  option.innerHTML = `${packPreview(pack)}<strong>${pack.name}</strong><span>${pack.shape === 'square' ? '밑면 2 × 2cm' : '지름 2cm'}</span><span>높이 ${pack.height}cm</span><span class="remaining"></span>`;
  option.addEventListener('click', () => { chosenPack = pack; cellKind = 'normal'; message(''); render(); });
  packOptions.append(option);
}
for (const [level,currentBoard] of floorBoards.entries()) {
const fragment = document.createDocumentFragment();
for (let y = 0; y < 40; y++) {
  for (let x = 0; x < 40; x++) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    cell.dataset.x = x;
    cell.dataset.level = level;
    cell.dataset.y = y;
    fragment.append(cell);
  }
}
currentBoard.append(fragment);
}

function render() {
  document.querySelector('#route-panel > p').textContent = collisionMode === 'climb'
    ? '팩 위로 통과: 다른 팩은 그대로 두고 올라가 지나갑니다. 도착 칸은 비워 주세요.'
    : '충돌 감지: 경로의 다른 팩과 겹치면 충돌 위치를 알려줍니다.';
  cellTools.hidden = !['drawing', 'start', 'destination'].includes(mode);
  for (const option of cellTools.querySelectorAll('button')) option.setAttribute('aria-pressed', String(option.dataset.kind === cellKind));
  const cellsByLayer = layerCells();
  const offsets = layerOffsets(cellsByLayer);
  document.querySelector('#swap-floors').hidden = !allLayers()[0] || !allLayers()[1];
  for (const button of document.querySelectorAll('#layer-tabs button')) {
    const index = Number(button.dataset.layer);
    const exists = index === activeLayer || layerSnapshots[index] !== null;
    button.setAttribute('aria-pressed', String(index === activeLayer));
    button.disabled = !exists && index > 0 && !cellsByLayer[index - 1].length;
    const values = [...numberCells(cellsByLayer[index], offsets[index]).values()];
    button.textContent = exists ? `${index + 1}층${values.length ? ` · ${offsets[index]}–${Math.max(...values)}` : ''}` : `＋ ${index + 1}층 만들기`;
    button.title = exists ? '이 층 편집하기' : '아래층 모양을 복사해 빈 위층 만들기';
  }
  const drawing = mode === 'drawing';
  const mapping = mode === 'start' || mode === 'destination' || mode === 'replace';
  replacePacks = mode === 'replace';
  replaceButton.hidden = placements.size === 0 || mode === 'drawing';
  replaceButton.textContent = replacePacks ? '팩 바꾸기 완료' : '팩 바꾸기';
  replaceButton.setAttribute('aria-pressed', String(replacePacks));
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
  boards.hidden = showing3D;
  for(const [level,currentBoard]of floorBoards.entries()){
    currentBoard.closest('.floor-pane').hidden = !allLayers()[level];
    currentBoard.closest('.floor-pane').classList.toggle('active-floor',level===activeLayer);
  }
  boards.style.setProperty('--floor-count',allLayers().filter(Boolean).length);
  threeView?.setVisible(showing3D);
  if (!numbering) { editingKey = null; editingPack = null; }
  dialog.hidden = !numbering || editingKey === null;
  const map = currentMap();
  for(const [level,currentBoard]of floorBoards.entries()){
  const layer=allLayers()[level];if(!layer)continue;
  const numbers = numberCells([...layer.values()], offsets[level]);
  for (const cell of currentBoard.children) {
    const key = `${cell.dataset.x},${cell.dataset.y}`;
    const active = layer.has(key);
    const globalKey=placeKey(key,level);
    const pack = map.get(globalKey);
    const kind = layer.get(key)?.kind;
    cell.classList.toggle('selected', active);
    cell.classList.toggle('occupied', Boolean(pack) || Boolean(kind));
    cell.classList.remove('moving-from');
    cell.classList.toggle('numbering-current', !dialog.hidden && globalKey === editingKey);
    cell.textContent = '';
    if (active) {
      const number = document.createElement('span');
      number.className = 'cell-number';
      number.textContent = numbers.get(key);
      number.style.setProperty('--number-size', Math.min(0.28, 0.8 / String(numbers.get(key)).length));
      number.style.setProperty('--corner-size', Math.min(0.17, 0.55 / String(numbers.get(key)).length));
      cell.append(number);
      if (kind) {
        const special = document.createElement('span');
        special.className = `special-cell ${kind}`;
        special.textContent = kind === 'hole' ? 'H' : 'X';
        special.title = kind === 'hole' ? '홀 · 통과 가능, 배치 불가' : `${kind === 'fixed-circle' ? '원형' : '사각'} 대형 고정팩 · 이동 불가`;
        cell.append(special);
      }
      const pose=poseOf(map,globalKey);
      if (pack && pose.anchor===globalKey) {
        const marker = document.createElement('span');
        marker.className = `pack-marker ${pack.shape}${pack.lying?` lying lying-${pose.axis}`:''}`;
        const label = document.createElement('span');
        label.textContent = pack.number ?? pack.size;
        label.style.setProperty('--pack-label-size', Math.min(0.22, 0.48 / String(pack.number ?? pack.size).length));
        const size = document.createElement('small');
        size.textContent = pack.number === null ? '' : pack.size;
        marker.append(label, size);
        marker.title = `${pack.name} · 높이 ${pack.height}cm${pack.number === null ? '' : ` · ${pack.number}번`}`;
        cell.append(marker);
      }
    }
    if (transitPack?.key === globalKey && routeOpen) {
      const moving = document.createElement('span');
      moving.className = `pack-marker traveller passing-over ${transitPack.pack.shape}${transitPack.pack.lying?` lying lying-${transitPack.axis}`:''}`;
      moving.textContent = transitPack.pack.number ?? transitPack.pack.size;
      moving.title = '다른 팩 위로 통과 중'; cell.append(moving);
    }
    cell.setAttribute('aria-pressed', String(active));
    cell.setAttribute('aria-label', `${Number(cell.dataset.y) + 1}행 ${Number(cell.dataset.x) + 1}열${active ? `, 칸 ${numbers.get(key)}번` : ''}${pack ? `, ${pack.name}, 높이 ${pack.height}cm, 팩 번호 ${pack.number ?? '미지정'}` : ''}`);
    cell.disabled = !drawing && !(active && (mapping || ((mode === 'numbering' || mode === 'destination-numbering') && pack)));
    if (kind) cell.setAttribute('aria-label', `${cell.getAttribute('aria-label')}, ${kind === 'hole' ? 'H 홀, 통과 가능 배치 불가' : 'X 대형 고정팩'}`);
  }
  currentBoard.classList.toggle('finished', !drawing);
  }
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
  const activeAction = mode === 'replace' ? replaceButton : mode === 'idle' && numberingComplete && destination.size === placements.size ? addRoute
    : mode === 'drawing' ? toggle : mode === 'start' ? startMap
    : mode === 'numbering' ? numberPacks : mode === 'destination' ? destinationButton
    : mode === 'destination-numbering' ? destinationNumbers
    : showingDestination ? destinationNumbers : numberingComplete ? destinationButton : placementComplete ? numberPacks : startMap;
  for (const button of document.querySelectorAll('.editor-actions > button')) button.classList.toggle('primary-action', button === activeAction);
  for (const button of document.querySelectorAll('.editor-actions > button')) {
    if (!button.hidden && button !== activeAction) button.hidden = true;
  }
  addRoute.classList.toggle('primary-action', activeAction === addRoute);
  const mapTabs = document.querySelector('#map-tabs');
  mapTabs.hidden = placements.size === 0 || mode !== 'idle';
  for (const button of mapTabs.querySelectorAll('button')) {
    button.disabled = button.dataset.map === 'end' && destination.size === 0;
    button.setAttribute('aria-pressed', String((button.dataset.map === 'end') === showingDestination));
  }
  viewStart.hidden = true;
  document.querySelector('main').dataset.tool = mapping ? 'packs' : !dialog.hidden ? 'numbers' : routeOpen ? 'routes' : 'none';
  document.querySelector('#pack-panel h2').textContent = replacePacks ? '팩 종류 바꾸기 · 번호 유지' : showingDestination ? '도착맵 만들기' : '시작맵 만들기';
  document.querySelector('#pack-panel > p').textContent = replacePacks
    ? '종류와 크기를 고르고 팩을 클릭하세요. 번호와 시작·도착 위치는 유지됩니다.'
    : '팩을 고른 뒤 칸을 클릭하세요. 같은 팩을 다시 놓으면 지워지고, 다른 팩을 놓으면 교체됩니다.';
  for (const option of packOptions.children) {
    option.setAttribute('aria-pressed', String(option.dataset.pack === chosenPack.id));
    option.querySelector('.remaining').textContent = showingDestination && !replacePacks
      ? `남은 수량 ${remaining(packs.find(pack => pack.id === option.dataset.pack)).length}개` : '';
  }
  const names = { drawing: '파레트 그리는 중', idle: showingDestination ? '도착맵 보기' : '시작맵 보기', start: '시작맵 배치 중', numbering: '팩 번호 매기는 중', destination: '도착맵 배치 중', 'destination-numbering': '도착맵 팩 번호 매기는 중' };
  status.textContent = `${activeLayer + 1}층 · ${names[mode]} · 파레트 ${allCells().length}칸 · 전체 팩 ${uniquePacks(map).length}개`;
  if (replacePacks) status.textContent = `팩 종류 변경 · 모든 층에서 번호와 도착 위치 유지`;
  const instructions = {
    drawing: '클릭으로 선택·해제하고, 누른 채 드래그하면 여러 칸을 선택합니다. 빈칸도 번호에 포함됩니다.',
    start: '팩을 골라 배치하세요. 배치를 마치면 팩 번호를 매길 수 있습니다.',
    numbering: '팩을 클릭해 번호를 입력하세요. 같은 번호나 도형을 여러 팩에 사용할 수 있습니다.',
    destination: '시작맵의 팩을 옮겨 배치하세요. 종류·크기별 남은 수량만 사용할 수 있고 번호는 그대로 유지됩니다.',
    'destination-numbering': '팩을 클릭해 같은 종류·크기의 시작맵 번호를 지정하세요. 이미 배치된 번호를 선택하면 두 팩의 번호가 교환됩니다.',
    idle: '시작맵 배치 → 팩 번호 매기기 → 도착맵 만들기 순서로 진행하세요.',
  };
  instruction.textContent = instructions[mode];
  if (replacePacks) instruction.textContent = '종류·크기를 고르고 팩을 클릭하세요. 번호와 도착맵의 같은 팩도 함께 유지됩니다.';
  if (showing3D) {
    instruction.textContent = `${showingDestination ? '도착맵' : '시작맵'} 3D 보기 · 사각팩 2×2cm / 원형팩 지름 2cm · 높이 소 4, 중 5, 대 6cm`;
    const sourceLayers = allLayers().map((layer,index)=>({cells:layer?[...layer.values()]:[],placements:localPacks(placements,index)}));
    const elevations = layerElevations(sourceLayers);
    const layers = allLayers().map((layer,index)=>({cells:layer?[...layer.values()]:[],placements:localPacks(currentMap(),index),level:index,offset:offsets[index],elevation:elevations[index],active:true}));
    threeView.setData([...selected.values()], currentMap(), { preserveView: routeOpen, layers, referenceLayers: sourceLayers, traveller: transitPack });
  }
  fitBoard();
  scheduleSave();
}

view3DButton.addEventListener('click', async () => {
  if (routePlayer.running) routePlayer.pause();
  if (threeLoading) return;
  message('');
  if (showing3D) {
    showing3D = false;
    if (routePlan) {
      const count = routePlayer.position;
      const key = count ? routePlan.steps[count-1].to : routePlan.steps[0].from;
      showLayer(Number(key.split(',')[2]));
    }
    render(); return;
  }
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

boards.addEventListener('pointerdown', event => {
  suppressDragClick = false;
  if (mode !== 'drawing' || cellKind !== 'normal' || event.button !== 0 || !event.isPrimary) return;
  const cell = event.target.closest('.cell');
  if (!cell) return;
  const clickedLevel=Number(cell.dataset.level);
  if(clickedLevel!==activeLayer)showLayer(clickedLevel);
  dragStroke = {
    pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
    previous: { x: Number(cell.dataset.x), y: Number(cell.dataset.y) },
    dragged: false,
  };
});
boards.addEventListener('pointermove', event => {
  if (!dragStroke || event.pointerId !== dragStroke.pointerId || mode !== 'drawing') return;
  if (!(event.buttons & 1)) { finishStroke(); return; }
  const rect = board.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX >= rect.right || event.clientY < rect.top || event.clientY >= rect.bottom) return;
  const origin = board.querySelector('.cell:not([hidden])');
  const size = parseFloat(board.style.getPropertyValue('--cell-size'));
  const x = Number(origin.dataset.x) + Math.floor((event.clientX - rect.left) / size);
  const y = Number(origin.dataset.y) + Math.floor((event.clientY - rect.top) / size);
  if (!dragStroke.dragged && Math.hypot(event.clientX - dragStroke.startX, event.clientY - dragStroke.startY) < 5) return;
  if (!dragStroke.dragged) board.setPointerCapture(event.pointerId);
  dragStroke.dragged = true;
  const previous = dragStroke.previous;
  const distance = Math.max(Math.abs(x - previous.x), Math.abs(y - previous.y));
  let changed = false;
  for (let i = 0; i <= distance; i++) {
    const nextX = Math.round(previous.x + (x - previous.x) * (distance ? i / distance : 0));
    const nextY = Math.round(previous.y + (y - previous.y) * (distance ? i / distance : 0));
    const key = `${nextX},${nextY}`;
    if (!selected.has(key)) { selected.set(key, { x: nextX, y: nextY }); changed = true; }
  }
  dragStroke.previous = { x, y };
  if (changed) { message(''); invalidate(); render(); }
});
function finishStroke() {
  if (!dragStroke) return;
  const { pointerId, dragged } = dragStroke;
  dragStroke = null;
  suppressDragClick = dragged;
  if (board.hasPointerCapture(pointerId)) board.releasePointerCapture(pointerId);
  fitBoard();
}
boards.addEventListener('pointerup', finishStroke);
window.addEventListener('pointerup', finishStroke);
boards.addEventListener('pointercancel', finishStroke);
boards.addEventListener('lostpointercapture', finishStroke);
window.addEventListener('blur', finishStroke);
boards.addEventListener('dragstart', event => event.preventDefault());
boards.addEventListener('click', event => {
  if (suppressDragClick && event.detail > 0) { suppressDragClick = false; return; }
  const cell = event.target.closest('.cell');
  if (!cell) return;
  const clickedLevel=Number(cell.dataset.level);
  if(clickedLevel!==activeLayer)showLayer(clickedLevel);
  const x = Number(cell.dataset.x);
  const y = Number(cell.dataset.y);
  const key = `${x},${y}`;
  const globalKey=placeKey(key,activeLayer);
  message('');
  if (mode === 'replace') {
    const pack = currentMap().get(globalKey);
    if (pack) { changePackType(pack, chosenPack); render(); }
    else message('종류를 바꿀 팩을 클릭해 주세요.');
    return;
  }

  if (['drawing', 'start', 'destination'].includes(mode) && cellKind !== 'normal') {
    const previous = selected.get(key);
    selected.set(key, previous?.kind === cellKind ? { x, y } : { x, y, kind: cellKind });
    const removed=placements.get(globalKey);for(const[k,p]of placements)if(p===removed)placements.delete(k);for(const[k,p]of destination)if(p===removed||k===globalKey)destination.delete(k);
    invalidate(); render(); return;
  }
  if (mode !== 'drawing' && selected.get(key)?.kind && ['start', 'destination'].includes(mode)) {
    message('X 고정팩과 H 홀에는 팩을 배치할 수 없습니다.'); return;
  }
  if (mode === 'drawing') {
    if (selected.has(key)) { selected.delete(key); placements.delete(globalKey); }
    else selected.set(key, { x, y });
    invalidate();
  } else if (mode === 'start' && selected.has(key)) {
    if (placements.get(globalKey)?.id === chosenPack.id) { const pack=placements.get(globalKey);for(const[k,p]of placements)if(p===pack)placements.delete(k); }
    else if (placements.has(globalKey)) changePackType(placements.get(globalKey), chosenPack);
    else placements.set(globalKey, { ...chosenPack, number: null });
    invalidate();
  } else if ((mode === 'numbering' || mode === 'destination-numbering') && currentMap().has(globalKey)) {
    openNumberPanel(globalKey);
    return;
  } else if (mode === 'destination' && selected.has(key)) {
    if (destination.get(globalKey)?.id === chosenPack.id) { const pack=destination.get(globalKey);for(const[k,p]of destination)if(p===pack)destination.delete(k); }
    else {
      const item = remaining(chosenPack)[0];
      if (!item) { message(`${chosenPack.name}의 남은 수량이 없습니다. 배치된 팩을 지운 뒤 다시 놓을 수 있습니다.`); return; }
      const sourceKey=[...placements].find(([,p])=>p===item)[0];
      const keys=footprint(globalKey,item.lying?poseOf(placements,sourceKey).axis:null);
      if(keys.some(k=>{const[x,y,l]=k.split(',');return !allLayers()[Number(l)]?.has(`${x},${y}`)||allLayers()[Number(l)].get(`${x},${y}`).kind||destination.has(k)})){message('눕힌팩을 놓을 인접한 두 칸을 비워 주세요.');return;}
      for(const k of keys)destination.set(k,item);
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
  normalizeLayouts(placements,destination);
  advanceNumberPanel();
});
document.querySelector('#cancel-number').addEventListener('click', closeNumberPanel);
dialog.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); closeNumberPanel(); }
});
try {
  previousWorkspaceText = localStorage.getItem(SAVE_KEY);
  loadPrevious.disabled = previousWorkspaceText === null;
  loadPrevious.title = previousWorkspaceText === null ? '아직 저장된 작업이 없습니다.' : '이번 접속 전에 저장된 작업을 불러옵니다.';
} catch {
  loadPrevious.disabled = true;
  saveStatus.textContent = '브라우저 저장 사용 불가'; saveStatus.dataset.error = 'true';
}
initialWorkspaceText = workspaceText();
loadPrevious.addEventListener('click', () => restoreWorkspace(previousWorkspaceText));
render();
routeInput.addEventListener('input', scheduleSave);
routeInput.addEventListener('input', () => { nextStep.disabled = false; });
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
