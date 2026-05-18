/**
 * Cross-browser fullscreen helpers (exam proctoring).
 * Fullscreen must be requested from a user gesture in most browsers.
 */

export const isDocumentFullscreen = () =>
  !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );

export const requestDocumentFullscreen = async () => {
  if (isDocumentFullscreen()) return true;

  const element = document.documentElement;

  try {
    if (element.requestFullscreen) {
      await element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
      await element.webkitRequestFullscreen();
    } else if (element.mozRequestFullScreen) {
      await element.mozRequestFullScreen();
    } else if (element.msRequestFullscreen) {
      await element.msRequestFullscreen();
    }
  } catch (err) {
    console.warn('Fullscreen request failed:', err?.message || err);
    return false;
  }

  return isDocumentFullscreen();
};
