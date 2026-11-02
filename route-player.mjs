export function createRoutePlayer({ onFrame, onStep, onComplete, onState, onSeek = () => {} }) {
  let steps = [], index = 0, progress = 0, previous = null, frame = null, running = false;
  function tick(time) {
    if (!running) return;
    if (previous !== null) progress = Math.min(1, progress + (time - previous) / 650);
    previous = time;
    onFrame(steps[index], progress, index);
    if (progress >= 1) {
      onStep(steps[index], index);
      index++; progress = 0;
      onState(running);
      if (index === steps.length) {
        running = false; frame = null; previous = null;
        onState(false); onComplete(); return;
      }
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
    onSeek(index, steps); onState(false);
    if (steps.length && index === steps.length) onComplete();
  }
  return {
    load(nextSteps) { pause(); steps = nextSteps; index = 0; progress = 0; },
    play() {
      if (running || !steps.length || index >= steps.length) return;
      running = true; previous = null; onState(true); frame = requestAnimationFrame(tick);
    },
    pause,
    next() { seek(index + 1); },
    back() { seek(progress > 0 ? index : index - 1); },
    get position() { return index; },
    get progress() { return progress; },
    get length() { return steps.length; },
    reset() { pause(); steps = []; index = 0; progress = 0; },
    get running() { return running; },
  };
}
