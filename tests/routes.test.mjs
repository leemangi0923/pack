import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareRoutes } from '../routes.mjs';
import { parsePackLabel } from '../pack-labels.mjs';

const cells = Array.from({ length: 24 }, (_, x) => ({ x, y: 0 }));
test('routes use pallet positions, keep pack identity, and chain sequentially', () => {
  const pack = { number: '◇' };
  const start = new Map([['9,0', pack]]);
  const plan = prepareRoutes('[[9,8,18,16,11],[11,6,8,23]]', cells, start);
  assert.deepEqual(plan.steps.map(step => step.toNumber), [8,18,16,11,6,8,23]);
  assert.equal(plan.result.get('23,0'), pack);
  assert.equal(plan.result.size, 1);
  assert.equal(start.get('9,0'), pack);
  assert.equal(start.size, 1);
});
test('rejects malformed input, missing cells, empty sources and occupied waypoints', () => {
  const start = new Map([['0,0', {}], ['2,0', {}]]);
  for (const text of ['oops', '{}', '[]', '[[0]]', '[[0,1.5]]', '[[0,24]]', '[[1,3]]', '[[0,2]]', '[[0,1],[0,3]]']) {
    assert.throws(() => prepareRoutes(text, cells, start), Error, text);
  }
  assert.throws(() => prepareRoutes('[[0,1]]', [{ x: 0, y: 0 }, { x: 2, y: 0 }], start), /파레트에 없습니다/);
});
test('the supplied 14 routes preserve all packs without overwriting any', () => {
  const text = '[[9,8,18,16,11],[21,16,18,8,9],[19,16,21],[7,8,18,19],[23,18,17],[11,6,8,23],[3,18],[4,3,8,6,1],[5,8,3,4],[18,3],[15,16,6,8,18],[20,15,16,6,5],[17,15,20],[18,15]]';
  const start = new Map([9,21,19,7,23,3,4,5,15,20].map(number => [`${number},0`, { number }]));
  const plan = prepareRoutes(text, cells, start);
  assert.equal(plan.routes.length, 14);
  assert.equal(plan.result.size, start.size);
  assert.deepEqual(new Set(plan.result.values()), new Set(start.values()));
});
test('pack labels support the four symbols and canonical numeric values', () => {
  assert.equal(parsePackLabel('0012'), 12);
  assert.equal(parsePackLabel('0'), 0);
  for (const label of ['○','△','□','◇']) assert.equal(parsePackLabel(label), label);
  for (const label of ['', '-1', '1.5', '1000000', 'hello']) assert.throws(() => parsePackLabel(label));
});
