import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoutePlayer } from '../route-player.mjs';

test('animation pauses without consuming time, completes once, and cancels on reset', t => {
  const scheduled = new Map();
  let sequence = 0;
  globalThis.requestAnimationFrame = callback => { scheduled.set(++sequence, callback); return sequence; };
  globalThis.cancelAnimationFrame = id => scheduled.delete(id);
  t.after(() => { delete globalThis.requestAnimationFrame; delete globalThis.cancelAnimationFrame; });
  const frame = time => { const callbacks = [...scheduled.values()]; scheduled.clear(); callbacks.forEach(callback => callback(time)); };
  const finished = [], frames = [];
  let completed = 0;
  const player = createRoutePlayer({
    onFrame: (step, progress) => frames.push([step, progress]),
    onStep: step => finished.push(step), onComplete: () => completed++, onState: () => {},
  });
  player.load(['first', 'second']); player.play(); player.play();
  assert.equal(scheduled.size, 1);
  frame(0); frame(325);
  assert.deepEqual(frames.at(-1), ['first', 0.5]);
  player.pause(); frame(800);
  assert.equal(scheduled.size, 0);
  player.play(); frame(1000);
  assert.deepEqual(frames.at(-1), ['first', 0.5]);
  frame(1325); frame(1975);
  assert.deepEqual(finished, ['first', 'second']);
  assert.equal(completed, 1);
  assert.equal(player.running, false);
  player.play(); assert.equal(scheduled.size, 0);
  player.load(['third']); player.play(); frame(2000); player.reset(); frame(3000);
  assert.deepEqual(finished, ['first', 'second']);
  assert.equal(completed, 1);
});
