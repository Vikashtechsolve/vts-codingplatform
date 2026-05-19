import { NAVBAR_LOGO_UPLOAD } from '../constants/branding';

const PROXY_SAFE_MAX_BYTES = 1024 * 1024; // 1 MB — typical nginx default is 1m

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image file'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function drawScaled(canvas, img, maxW, maxH) {
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return { w, h };
}

async function blobUnderLimit(canvas, preferPng) {
  if (preferPng) {
    const png = await canvasToBlob(canvas, 'image/png');
    if (png && png.size <= PROXY_SAFE_MAX_BYTES) {
      return { blob: png, ext: '.png', mime: 'image/png' };
    }
  }

  const qualities = [0.88, 0.78, 0.65, 0.52];
  for (const q of qualities) {
    const webp = await canvasToBlob(canvas, 'image/webp', q);
    if (webp && webp.size <= PROXY_SAFE_MAX_BYTES) {
      return { blob: webp, ext: '.webp', mime: 'image/webp' };
    }
  }
  for (const q of qualities) {
    const jpeg = await canvasToBlob(canvas, 'image/jpeg', q);
    if (jpeg && jpeg.size <= PROXY_SAFE_MAX_BYTES) {
      return { blob: jpeg, ext: '.jpg', mime: 'image/jpeg' };
    }
  }

  const fallback = await canvasToBlob(canvas, preferPng ? 'image/png' : 'image/webp', 0.5);
  if (fallback) {
    return {
      blob: fallback,
      ext: preferPng ? '.png' : '.webp',
      mime: preferPng ? 'image/png' : 'image/webp',
    };
  }
  return null;
}

/**
 * Resize logo for navbar display and compress so uploads pass typical reverse-proxy limits (1 MB).
 */
export async function compressLogoImage(file) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('Please choose a valid image file');
  }

  if (file.size <= PROXY_SAFE_MAX_BYTES) {
    const img = await loadImage(file);
    const maxW = NAVBAR_LOGO_UPLOAD.recommendedMaxWidth;
    const maxH = NAVBAR_LOGO_UPLOAD.recommendedHeight;
    if (img.width <= maxW * 2 && img.height <= maxH * 2) {
      return file;
    }
  }

  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  const preferPng = file.type === 'image/png' || file.type === 'image/gif';

  let maxW = NAVBAR_LOGO_UPLOAD.recommendedMaxWidth;
  let maxH = NAVBAR_LOGO_UPLOAD.recommendedHeight;

  drawScaled(canvas, img, maxW, maxH);
  let result = await blobUnderLimit(canvas, preferPng);

  for (let i = 0; i < 3 && result && result.blob.size > PROXY_SAFE_MAX_BYTES; i += 1) {
    maxW = Math.round(maxW * 0.85);
    maxH = Math.round(maxH * 0.85);
    drawScaled(canvas, img, maxW, maxH);
    result = await blobUnderLimit(canvas, preferPng);
  }

  if (!result?.blob) {
    throw new Error('Could not compress image. Try a smaller file or PNG/JPG under 5 MB.');
  }

  const base = file.name.replace(/\.[^.]+$/, '') || 'logo';
  return new File([result.blob], `${base}${result.ext}`, {
    type: result.mime,
    lastModified: Date.now(),
  });
}
