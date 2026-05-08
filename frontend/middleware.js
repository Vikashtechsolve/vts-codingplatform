/**
 * Vercel Edge Middleware: proxies same-origin /api and /uploads to your real backend.
 *
 * Fixes "Network Error" on some devices when their network blocks *.railway.app (or similar)
 * but allows your frontend domain (e.g. *.vercel.app).
 *
 * Setup (Vercel project → Settings → Environment Variables):
 *   BACKEND_ORIGIN = https://your-service.up.railway.app   (no trailing slash; no /api suffix)
 *
 * Frontend build env:
 *   REACT_APP_API_URL = /api
 *
 * Redeploy after setting BACKEND_ORIGIN. Omit BACKEND_ORIGIN only if you call the API by full URL from the browser (no proxy).
 */

export const config = {
  matcher: ['/api/:path*', '/uploads/:path*'],
};

export default async function middleware(request) {
  const backend = (process.env.BACKEND_ORIGIN || '').trim().replace(/\/$/, '');
  if (!backend) {
    return new Response(
      JSON.stringify({
        message:
          'API proxy is not configured. Set BACKEND_ORIGIN on Vercel to your backend origin, or use a full https REACT_APP_API_URL instead of /api.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  const url = new URL(request.url);
  const targetUrl = `${backend}${url.pathname}${url.search}`;

  const headers = new Headers(request.headers);
  ['host', 'connection', 'content-length', 'transfer-encoding'].forEach((h) => headers.delete(h));

  /** @type {RequestInit} */
  const init = {
    method: request.method,
    headers,
    redirect: 'manual',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > 0) {
      init.body = buf;
    }
  }

  try {
    return await fetch(targetUrl, init);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upstream fetch failed';
    return new Response(JSON.stringify({ message: `Proxy error: ${msg}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}
