import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sceneModel } from '../scene-model.mjs';
import { packs } from '../packs.mjs';

test('positions use centimetres and preserve gaps and pallet numbering', () => {
  const scene = sceneModel([{ x: 4, y: 2 }, { x: 7, y: 4 }], new Map());
  assert.deepEqual(scene.map(({ x, z, cellNumber }) => ({ x, z, cellNumber })), [
    { x: -3, z: -2, cellNumber: 0 }, { x: 3, z: 2, cellNumber: 11 },
  ]);
});
test('keeps six pack dimensions and assigned numbers for either map', () => {
  const cells = packs.map((pack, x) => ({ x, y: 0 }));
  const placements = new Map(packs.map((pack, x) => [`${x},0`, { ...pack, number: x }]));
  const scene = sceneModel(cells, placements);
  assert.deepEqual(scene.map(item => item.pack.width), [2, 2, 2, 2, 2, 2]);
  assert.deepEqual(scene.map(item => item.pack.height), [4, 5, 6, 4, 5, 6]);
  assert.deepEqual(scene.map(item => item.pack.number), [0, 1, 2, 3, 4, 5]);
  assert.equal(scene[1].x - scene[0].x, 2);
  assert.deepEqual(sceneModel([], placements), []);
});
