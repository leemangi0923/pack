export function createRoutePlayer({ onFrame, onStep, onComplete, onState, onSeek = () => {}, getDuration = () => 650, getDelay = () => 0, onWait = () => {} }) {
  let steps = [], index = 0, progress = 0, previous = null, frame = null, running = false;
  let reverse = false, single = false, delay = 0;
  function emitFrame() {
    const stepIndex = reverse ? index - 1 : index;
    const step = steps[stepIndex];
    const motion = reverse ? { ...step, from: step.to, to: step.from, fromNumber: step.toNumber,
      toNumber: step.fromNumber, fromHeight: step.toHeight, toHeight: step.fromHeight } : step;
    onFrame(motion, progress, stepIndex);
  }
  function tick(time) {
    if (!running) return;
    if (delay > 0) {
      if (previous !== null) delay = Math.max(0,delay-(time-previous));
      previous=time;
      onWait(delay);
      if(delay===0)previous=null;
      frame=requestAnimationFrame(tick);return;
    }
    if (previous !== null) progress = Math.min(1, progress + (time - previous) / Math.max(1,getDuration(steps[reverse?index-1:index])));
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
      delay=Math.max(0,getDelay(steps[index-1],steps[index]));
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
    index = next; progress = 0; delay=0;
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
    delay=0; single = true; running = true; previous = null;
    onState(true); emitFrame(); frame = requestAnimationFrame(tick);
  }
  return {
    load(nextSteps) { pause(); steps = nextSteps; index = 0; progress = 0; delay=0; reverse = false; single = false; },
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
    reset() { pause(); steps = []; index = 0; progress = 0; delay=0; reverse = false; single = false; onState(false); },
    get running() { return running; },
  };
}
