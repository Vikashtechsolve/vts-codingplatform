/**
 * Acquire mic (+ optional camera) for live interview with sensible fallbacks.
 */
export async function acquireInterviewMediaStream() {
  if (!navigator.mediaDevices?.getUserMedia) {
    const err = new Error('Your browser does not support microphone access. Please use Chrome or Edge.');
    err.code = 'NOT_SUPPORTED';
    throw err;
  }

  const audio = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1
  };

  const video = {
    facingMode: 'user',
    width: { ideal: 640, max: 1280 },
    height: { ideal: 480, max: 720 }
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio, video });
    return { stream, hasVideo: true };
  } catch (firstError) {
    const name = firstError?.name || '';

    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      const err = new Error(
        'Microphone access was blocked. Click the lock icon in your browser address bar, allow Microphone (and Camera), then refresh.'
      );
      err.code = 'PERMISSION_DENIED';
      throw err;
    }

    if (name === 'NotReadableError' || name === 'TrackStartError') {
      const err = new Error(
        'Your microphone or camera is in use by another app. Close other apps (Zoom, Teams, etc.) and try again.'
      );
      err.code = 'DEVICE_BUSY';
      throw err;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio });
      return { stream, hasVideo: false };
    } catch (audioError) {
      if (audioError?.name === 'NotAllowedError' || audioError?.name === 'PermissionDeniedError') {
        const err = new Error(
          'Microphone access was blocked. Allow microphone permission for this site and refresh.'
        );
        err.code = 'PERMISSION_DENIED';
        throw err;
      }
      const err = new Error(
        audioError?.message || 'Could not access microphone. Check your device settings and try again.'
      );
      err.code = 'MIC_FAILED';
      throw err;
    }
  }
}

export function isStreamActive(stream) {
  if (!stream) return false;
  return stream.getAudioTracks().some(t => t.readyState === 'live' && t.enabled);
}

export function stopMediaStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach((t) => {
    try { t.stop(); } catch (e) {}
  });
}
