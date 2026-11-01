export function createRoutePlayer({ onFrame, onStep, onComplete, onState }) {
  let steps = [], index = 0, progress = 0, previous = null, frame = null, running = false;
  function tick(time) {
    if (!running) return;
    if (previous !== null) progress = Math.min(1, progress + (time - previous) / 650);
    previous = time;
    onFrame(steps[index], progress, index);
    if (progress >= 1) {
      onStep(steps[index], index);
      index++; progress = 0;
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
  return {
    load(nextSteps) { pause(); steps = nextSteps; index = 0; progress = 0; },
    play() {
      if (running || !steps.length || index >= steps.length) return;
      running = true; previous = null; onState(true); frame = requestAnimationFrame(tick);
    },
    pause,
    reset() { pause(); steps = []; index = 0; progress = 0; },
    get running() { return running; },
  };
}
