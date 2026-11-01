import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextPackKey } from '../pack-order.mjs';

test('moves right across gaps regardless of placement order', () => {
  assert.equal(nextPackKey(['8,2', '1,4', '2,2', '5,2'], '2,2'), '5,2');
  assert.equal(nextPackKey(['8,2', '1,4', '2,2', '5,2'], '5,2'), '8,2');
});
test('moves to leftmost pack in next occupied row, skipping empty rows', () => {
  assert.equal(nextPackKey(['8,2', '5,5', '1,5', '3,8'], '8,2'), '1,5');
});
test('ends at last pack without wrapping and handles absent keys', () => {
  assert.equal(nextPackKey(['2,3', '10,3'], '10,3'), null);
  assert.equal(nextPackKey(['2,3'], '2,3'), null);
  assert.equal(nextPackKey([], '2,3'), null);
  assert.equal(nextPackKey(['2,3'], '1,1'), null);
});
