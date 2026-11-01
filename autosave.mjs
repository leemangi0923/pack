import { packs } from './packs.mjs';
import { parsePackLabel } from './pack-labels.mjs';

export const SAVE_KEY = 'pack.workspace.v1';
const modes = ['drawing', 'idle', 'start', 'numbering', 'destination', 'destination-numbering'];

export function encodeWorkspace(state) {
  const source = [...state.placements];
  const identities = new Map(source.map(([, pack], index) => [pack, index]));
  return JSON.stringify({
    schema: 1,
    cells: [...state.selected.values()].map(({ x, y }) => [x, y]),
    packs: source.map(([key, pack]) => [key, pack.id, pack.number]),
    destination: [...state.destination].map(([key, pack]) => [key, identities.get(pack)]),
    mode: state.mode, showingDestination: state.showingDestination,
    placementComplete: state.placementComplete, numberingComplete: state.numberingComplete,
    chosenPack: state.chosenPack.id, routeText: state.routeText,
    numberDraft: state.numberDraft,
  });
}

export function decodeWorkspace(text) {
  const data = JSON.parse(text);
  const check = condition => { if (!condition) throw new Error('유효하지 않은 저장 데이터'); };
  check(data && data.schema === 1 && Array.isArray(data.cells) && data.cells.length <= 1600);
  const selected = new Map();
  for (const cell of data.cells) {
    check(Array.isArray(cell) && cell.length === 2 && cell.every(n => Number.isInteger(n) && n >= 0 && n < 40));
    const [x, y] = cell;
    check(!selected.has(`${x},${y}`)); selected.set(`${x},${y}`, { x, y });
  }
  check(Array.isArray(data.packs) && data.packs.length <= selected.size);
  const placements = new Map(), identities = [];
  for (const record of data.packs) {
    check(Array.isArray(record) && record.length === 3);
    const [key, id, number] = record;
    const type = packs.find(pack => pack.id === id);
    check(selected.has(key) && !placements.has(key) && type);
    check(number === null || parsePackLabel(number) === number);
    const pack = { ...type, number };
    placements.set(key, pack); identities.push(pack);
  }
  check(Array.isArray(data.destination) && data.destination.length <= placements.size);
  const destination = new Map(), used = new Set();
  for (const record of data.destination) {
    check(Array.isArray(record) && record.length === 2);
    const [key, index] = record;
    check(selected.has(key) && !destination.has(key) && Number.isInteger(index) && identities[index] && !used.has(index));
    destination.set(key, identities[index]); used.add(index);
  }
  check(modes.includes(data.mode) && typeof data.showingDestination === 'boolean');
  check(typeof data.placementComplete === 'boolean' && typeof data.numberingComplete === 'boolean');
  check(typeof data.routeText === 'string' && data.routeText.length <= 1000000);
  const chosenPack = packs.find(pack => pack.id === data.chosenPack);
  check(chosenPack);
  let numberDraft = null;
  if (data.numberDraft !== null && data.numberDraft !== undefined) {
    const draft = data.numberDraft;
    const map = data.showingDestination ? destination : placements;
    check((data.mode === 'numbering' || data.mode === 'destination-numbering') && map.has(draft.key));
    check(typeof draft.value === 'string' && draft.value.length <= 6);
    numberDraft = { key: draft.key, value: draft.value };
  }
  return {
    selected, placements, destination, mode: data.mode, showingDestination: data.showingDestination,
    placementComplete: data.placementComplete && placements.size > 0,
    numberingComplete: data.numberingComplete && placements.size > 0 && identities.every(pack => pack.number !== null),
    chosenPack, routeText: data.routeText, numberDraft,
  };
}
