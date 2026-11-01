import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeWorkspace, decodeWorkspace } from '../autosave.mjs';
import { packs } from '../packs.mjs';

function workspace() {
  const a = { ...packs[0], number: '○' }, b = { ...packs[0], number: '○' };
  return {
    selected: new Map([['1,2', { x: 1, y: 2 }], ['2,2', { x: 2, y: 2 }]]),
    placements: new Map([['1,2', a], ['2,2', b]]),
    destination: new Map([['2,2', a], ['1,2', b]]),
    mode: 'destination-numbering', showingDestination: true,
    placementComplete: true, numberingComplete: true, chosenPack: packs[3],
    routeText: '[[0,1]]', numberDraft: { key: '2,2', value: '123' },
  };
}
test('round trip retains duplicate labels, distinct pack identities, maps and draft', () => {
  const original = workspace();
  const restored = decodeWorkspace(encodeWorkspace(original));
  assert.deepEqual(restored, original);
  assert.equal(restored.destination.get('2,2'), restored.placements.get('1,2'));
  assert.notEqual(restored.placements.get('1,2'), restored.placements.get('2,2'));
});
test('an empty pallet and incomplete pack numbers can be restored', () => {
  const state = workspace();
  state.selected.clear(); state.placements.clear(); state.destination.clear();
  state.mode = 'drawing'; state.numberDraft = null;
  const restored = decodeWorkspace(encodeWorkspace(state));
  assert.equal(restored.selected.size, 0);
  assert.equal(restored.numberingComplete, false);
  const draft = workspace(); draft.placements.get('1,2').number = null;
  assert.equal(decodeWorkspace(encodeWorkspace(draft)).numberingComplete, false);
});
test('rejects corrupt or inconsistent records rather than partially restoring', () => {
  assert.throws(() => decodeWorkspace('invalid'));
  for (const change of [
    data => { data.schema = 99; },
    data => { data.cells[0][0] = 40; },
    data => { data.packs[0][1] = 'unknown'; },
    data => { data.packs[0][2] = '<script>'; },
    data => { data.destination[0][1] = 9; },
    data => { data.destination[0][1] = data.destination[1][1]; },
    data => { data.numberDraft.key = '39,39'; },
  ]) {
    const data = JSON.parse(encodeWorkspace(workspace())); change(data);
    assert.throws(() => decodeWorkspace(JSON.stringify(data)));
  }
});
