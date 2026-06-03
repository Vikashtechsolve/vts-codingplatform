/**
 * Reliable MediaRecorder setup for interview answers (audio-only, mime fallbacks).
 */

export function getSupportedRecorderMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg'
  ];

  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return '';
}

/**
 * MediaRecorder must use audio tracks only — recording a video+audio stream
 * with audio/webm often throws on start in Chrome/Safari.
 */
export function getAudioOnlyStream(stream) {
  if (!stream) return null;
  const audioTracks = stream.getAudioTracks().filter(t => t.readyState === 'live' && t.enabled);
  if (!audioTracks.length) return null;
  return new MediaStream(audioTracks);
}

export function createAnswerMediaRecorder(stream) {
  const audioStream = getAudioOnlyStream(stream);
  if (!audioStream) {
    throw new Error('No active microphone track. Check mic permissions and try again.');
  }

  const preferred = getSupportedRecorderMimeType();
  const tryTypes = [
    preferred,
    'audio/webm',
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/ogg'
  ].filter((t, i, arr) => t && arr.indexOf(t) === i);

  let lastError = null;
  for (const mimeType of tryTypes) {
    if (mimeType && !MediaRecorder.isTypeSupported(mimeType)) continue;
    try {
      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(audioStream, options);
      recorder._usedMimeType = mimeType || recorder.mimeType || 'audio/webm';
      return recorder;
    } catch (err) {
      lastError = err;
    }
  }

  try {
    const recorder = new MediaRecorder(audioStream);
    recorder._usedMimeType = recorder.mimeType || 'audio/webm';
    return recorder;
  } catch (err) {
    throw lastError || err || new Error('MediaRecorder is not supported in this browser.');
  }
}

export function waitForRecorderInactive(recorder, maxMs = 800) {
  if (!recorder || recorder.state === 'inactive') {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => resolve();
    const timer = setTimeout(done, maxMs);
    recorder.addEventListener('stop', () => {
      clearTimeout(timer);
      done();
    }, { once: true });
    recorder.addEventListener('error', () => {
      clearTimeout(timer);
      done();
    }, { once: true });
    try {
      recorder.stop();
    } catch (e) {
      clearTimeout(timer);
      done();
    }
  });
}

export function startAnswerRecorder(recorder, timesliceMs = 500) {
  if (!recorder) {
    throw new Error('Recorder not initialized');
  }
  if (recorder.state !== 'inactive') {
    throw new Error(`Recorder is already ${recorder.state}`);
  }

  try {
    if (timesliceMs > 0) {
      recorder.start(timesliceMs);
    } else {
      recorder.start();
    }
  } catch (err) {
    try {
      recorder.start();
    } catch (err2) {
      throw err2 || err;
    }
  }
}
