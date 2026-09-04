/**
 * Rewrite HLS playlists so segment/playlist URIs go through our media API
 * (or a provided URL map). Keeps comments/tags intact.
 */

function fileNameFromRef(ref) {
  return String(ref || '')
    .trim()
    .split('/')
    .pop()
    .split('?')[0];
}

function collectHlsRefs(body) {
  const refs = new Set();
  String(body || '')
    .split('\n')
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (trimmed.startsWith('#')) {
        const match = trimmed.match(/URI="([^"]+)"/);
        if (match && !/^https?:\/\//i.test(match[1])) {
          refs.add(fileNameFromRef(match[1]));
        }
        return;
      }
      refs.add(fileNameFromRef(trimmed));
    });
  return [...refs].filter(Boolean);
}

function applyHlsRefs(body, urlByName) {
  return String(body || '')
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (full, uri) => {
          if (/^https?:\/\//i.test(uri)) return full;
          const name = fileNameFromRef(uri);
          return urlByName[name] ? `URI="${urlByName[name]}"` : full;
        });
      }
      const name = fileNameFromRef(trimmed);
      return urlByName[name] || line;
    })
    .join('\n');
}

function mediaProxyUrl({ apiBase, fileName, token }) {
  return `${apiBase}?name=${encodeURIComponent(fileName)}&token=${encodeURIComponent(token)}`;
}

function rewritePlaylistToProxy(body, { apiBase, token }) {
  const urlByName = {};
  collectHlsRefs(body).forEach((name) => {
    urlByName[name] = mediaProxyUrl({ apiBase, fileName: name, token });
  });
  return applyHlsRefs(body, urlByName);
}

module.exports = {
  collectHlsRefs,
  applyHlsRefs,
  mediaProxyUrl,
  rewritePlaylistToProxy,
  fileNameFromRef,
};
