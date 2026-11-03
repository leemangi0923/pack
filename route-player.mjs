export function createRoutePlayer({ onFrame, onStep, onComplete, onState, onSeek = () => {} }) {
  let steps = [], index = 0, progress = 0, previous = null, frame = null, running = false;
  let reverse = false, single = false;
  function emitFrame() {
    const stepIndex = reverse ? index - 1 : index;
    const step = steps[stepIndex];
    const motion = reverse ? { ...step, from: step.to, to: step.from, fromNumber: step.toNumber,
      toNumber: step.fromNumber, fromHeight: step.toHeight, toHeight: step.fromHeight } : step;
    onFrame(motion, progress, stepIndex);
  }
  function tick(time) {
    if (!running) return;
    if (previous !== null) progress = Math.min(1, progress + (time - previous) / 650);
    previous = time;
    emitFrame();
    if (progress >= 1) {
      if (reverse) { index--; onSeek(index, steps); }
      else { onStep(steps[index], index); index++; }
      progress = 0; reverse = false;
      onState(running);
      if (index === steps.length) {
        running = false; frame = null; previous = null;
        onState(false); onComplete(); return;
      }
      if (single) { running = false; frame = null; previous = null; onState(false); return; }
    }
    frame = requestAnimationFrame(tick);
  }
  function pause() {
    running = false; previous = null;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null; onState(false);
  }
  function seek(target) {
    pause();
    const next = Math.max(0, Math.min(steps.length, target));
    if (next === index && progress === 0) return;
    index = next; progress = 0;
    reverse = false; single = false;
    onSeek(index, steps); onState(false);
    if (steps.length && index === steps.length) onComplete();
  }
  function animate(backwards) {
    pause();
    if (reverse !== backwards && progress > 0) {
      index += backwards ? 1 : -1;
      progress = 1 - progress;
      onSeek(index, steps);
    }
    reverse = backwards;
    if ((!reverse && index >= steps.length) || (reverse && index <= 0) || !steps.length) {
      reverse = false; single = false; progress = 0; onState(false); return;
    }
    single = true; running = true; previous = null;
    onState(true); emitFrame(); frame = requestAnimationFrame(tick);
  }
  return {
    load(nextSteps) { pause(); steps = nextSteps; index = 0; progress = 0; reverse = false; single = false; },
    play() {
      if (running || !steps.length || (!reverse && index >= steps.length)) return;
      single = reverse;
      running = true; previous = null; onState(true); frame = requestAnimationFrame(tick);
    },
    pause,
    seek,
    next() { seek(index + 1); },
    back() { seek(progress > 0 ? index : index - 1); },
    animateNext() { animate(false); },
    animateBack() { animate(true); },
    get stepping() { return single; },
    get position() { return index; },
    get progress() { return progress; },
    get length() { return steps.length; },
    reset() { pause(); steps = []; index = 0; progress = 0; reverse = false; single = false; onState(false); },
    get running() { return running; },
  };
}
