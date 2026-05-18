import { getPublicApiOrigin } from '../config/apiBase';

/** Resolve upload/media paths against the backend origin from REACT_APP_API_URL. */
export function resolveMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  const origin = getPublicApiOrigin() || '';
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}
