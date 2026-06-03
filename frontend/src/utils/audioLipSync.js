/**
 * Real-time speech metrics from TTS audio (keeps audio audible through analyser).
 */

function computeViseme(freqData) {
  let bass = 0;
  let mid = 0;
  let treble = 0;
  const len = freqData.length;
  for (let i = 0; i < len; i++) {
    if (i < 10) bass += freqData[i];
    else if (i < 28) mid += freqData[i];
    else treble += freqData[i];
  }
  const total = bass + mid + treble || 1;
  const b = bass / total;
  const m = mid / total;
  const t = treble / total;
  if (b > 0.44) return 2;
  if (m > 0.4) return 3;
  if (t > 0.36) return 4;
  if (m > 0.34) return 1;
  return 0;
}

export function attachAudioLipSync(audioElement, onFrame) {
  if (!audioElement || typeof onFrame !== 'function') {
    return () => {};
  }

  let rafId = null;
  let ctx = null;
  let analyser = null;

  const emit = (level, viseme) => {
    onFrame({ level, viseme });
  };

  const cleanup = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    emit(0, 0);
  };

  const loop = () => {
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    let sum = 0;
    const len = Math.min(64, data.length);
    for (let i = 0; i < len; i++) sum += data[i];
    const avg = sum / len;
    const level = Math.min(1, Math.max(0, (avg - 5) / 34));
    const viseme = level > 0.08 ? computeViseme(data) : 0;
    emit(level, viseme);
    rafId = requestAnimationFrame(loop);
  };

  const connect = async () => {
    try {
      if (!audioElement._lipSyncNode) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        const source = ctx.createMediaElementSource(audioElement);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.18;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        audioElement._lipSyncNode = { ctx, analyser };
      } else {
        ctx = audioElement._lipSyncNode.ctx;
        analyser = audioElement._lipSyncNode.analyser;
      }
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      loop();
    } catch (e) {
      emit(0, 0);
    }
  };

  const onPlay = () => connect();
  audioElement.addEventListener('play', onPlay);
  if (!audioElement.paused && !audioElement.ended) {
    connect();
  }

  return () => {
    audioElement.removeEventListener('play', onPlay);
    cleanup();
  };
}

export function runSimulatedLipSync(isActive, onFrame) {
  if (!isActive || typeof onFrame !== 'function') {
    onFrame?.({ level: 0, viseme: 0 });
    return () => {};
  }
  let rafId = null;
  let phase = 0;
  const tick = () => {
    phase += 0.13;
    const level = 0.12 + Math.abs(Math.sin(phase)) * 0.5 + Math.abs(Math.sin(phase * 2.7)) * 0.28;
    const viseme = Math.floor((phase * 1.4) % 5);
    onFrame({ level: Math.min(1, level), viseme });
    rafId = requestAnimationFrame(tick);
  };
  tick();
  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    onFrame({ level: 0, viseme: 0 });
  };
}
