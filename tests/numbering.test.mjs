import { test } from 'node:test';
import assert from 'node:assert/strict';
import { numberCells } from '../numbering.mjs';

test('first cell is zero, horizontal and vertical neighbors are one', () => {
  assert.deepEqual([...numberCells([{ x: 4, y: 3 }]).values()], [0]);
  assert.deepEqual([...numberCells([{ x: 4, y: 3 }, { x: 5, y: 3 }]).values()], [0, 1]);
  assert.deepEqual([...numberCells([{ x: 4, y: 3 }, { x: 4, y: 4 }]).values()], [0, 1]);
});
test('gaps count and lower rows use the full bounding width', () => {
  assert.deepEqual([...numberCells([{ x: 4, y: 3 }, { x: 5, y: 3 }, { x: 7, y: 3 }, { x: 4, y: 5 }]).values()], [0, 1, 3, 8]);
});
test('adding cells above or left recalculates existing numbers', () => {
  assert.deepEqual([...numberCells([{ x: 4, y: 3 }, { x: 3, y: 3 }]).values()], [1, 0]);
  assert.deepEqual([...numberCells([{ x: 4, y: 3 }, { x: 4, y: 2 }]).values()], [1, 0]);
});
test('empty selection and nonrectangular selection', () => {
  assert.equal(numberCells([]).size, 0);
  assert.deepEqual([...numberCells([{ x: 5, y: 2 }, { x: 3, y: 4 }]).values()], [2, 6]);
});
