/**
 * Tiny store for real-time speech frames (level + viseme).
 * Animators poll it inside requestAnimationFrame so React never re-renders per audio frame.
 */
export function createSpeechFrameStore() {
  let frame = { level: 0, viseme: 0, at: 0 };
  const listeners = new Set();

  const set = (level = 0, viseme = 0) => {
    frame = {
      level: Math.min(1, Math.max(0, Number(level) || 0)),
      viseme: Number(viseme) || 0,
      at: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    };
    listeners.forEach((fn) => fn(frame));
  };

  return {
    set,
    reset: () => set(0, 0),
    get: () => frame,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
