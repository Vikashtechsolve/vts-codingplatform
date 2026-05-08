/**
 * Public diagnostics page — open from any device that has trouble logging in.
 * It does NOT use axios; it uses fetch() directly so we surface the raw failure
 * mode (DNS, TLS, CORS, mixed-content, HTTP error) without our error wrapper.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { getAxiosBaseURL, normalizeApiBaseUrl, sanitizeEnvUrl } from '../config/apiBase';

const KNOWN_PUBLIC = 'https://httpbin.org/get';

const fmt = (v) => {
  if (v === undefined) return '(undefined)';
  if (v === null) return '(null)';
  if (typeof v === 'string') return v === '' ? '(empty string)' : v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

async function probe(url, init = {}) {
  const start = performance.now();
  try {
    const res = await fetch(url, { method: 'GET', cache: 'no-store', ...init });
    const elapsed = Math.round(performance.now() - start);
    let bodyText = '';
    try {
      bodyText = (await res.text()).slice(0, 600);
    } catch {
      bodyText = '(could not read body)';
    }
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      headers: {
        contentType: res.headers.get('content-type'),
        cors: res.headers.get('access-control-allow-origin'),
        server: res.headers.get('server'),
      },
      body: bodyText,
      elapsedMs: elapsed,
    };
  } catch (e) {
    const elapsed = Math.round(performance.now() - start);
    return {
      ok: false,
      error: e?.name + ': ' + (e?.message || String(e)),
      elapsedMs: elapsed,
    };
  }
}

const Section = ({ title, children }) => (
  <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 12, background: '#fafafa' }}>
    <h3 style={{ margin: '0 0 8px 0' }}>{title}</h3>
    {children}
  </div>
);

const Row = ({ label, value, mono }) => (
  <div style={{ display: 'flex', gap: 8, margin: '4px 0', alignItems: 'flex-start' }}>
    <div style={{ minWidth: 200, color: '#555' }}>{label}</div>
    <div style={{ flex: 1, fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit', wordBreak: 'break-all' }}>
      {fmt(value)}
    </div>
  </div>
);

const Diagnostics = () => {
  const [resolvedBase, setResolvedBase] = useState('');
  const [absBase, setAbsBase] = useState('');
  const [windowInfo, setWindowInfo] = useState(null);
  const [results, setResults] = useState({ same: null, abs: null, internet: null, cors: null });
  const [loading, setLoading] = useState(false);
  const [absInput, setAbsInput] = useState(() => sanitizeEnvUrl(process.env.REACT_APP_API_URL) || '');

  const runProbes = useCallback(async () => {
    setLoading(true);
    const base = getAxiosBaseURL();
    setResolvedBase(base);

    const userAbs = normalizeApiBaseUrl(absInput);
    setAbsBase(userAbs);

    setWindowInfo({
      pageOrigin: window.location.origin,
      pageProtocol: window.location.protocol,
      userAgent: navigator.userAgent,
      onLine: navigator.onLine,
      buildEnv: process.env.NODE_ENV,
      buildEnvVar: sanitizeEnvUrl(process.env.REACT_APP_API_URL) || '(not set in build)',
      runtimeEnvVar:
        (window.__RUNTIME_CONFIG__ && sanitizeEnvUrl(window.__RUNTIME_CONFIG__.REACT_APP_API_URL)) ||
        '(not set in runtime-config.js)',
    });

    const sameRes = base ? await probe(`${base}/health`) : { error: 'No API base URL configured' };
    const absRes = userAbs ? await probe(`${userAbs}/health`) : { skipped: true };
    const corsCheck = base
      ? await probe(`${base}/health`, {
          method: 'OPTIONS',
          headers: {
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'authorization,content-type',
            Origin: window.location.origin,
          },
        })
      : null;
    const inetRes = await probe(KNOWN_PUBLIC);

    setResults({ same: sameRes, abs: absRes, internet: inetRes, cors: corsCheck });
    setLoading(false);
  }, [absInput]);

  useEffect(() => {
    runProbes();
  }, [runProbes]);

  const summary = (() => {
    const r = results.same;
    if (!r) return 'Running…';
    if (r.ok) return '✅ API reachable from this device.';
    if (r.error?.includes('Failed to fetch') || r.error?.includes('NetworkError') || r.error?.includes('TypeError')) {
      const inet = results.internet;
      if (inet && !inet.ok) {
        return '❌ This device looks offline or the network blocks general HTTPS calls.';
      }
      return (
        '❌ Cannot reach the API host. Most likely: this network/DNS is blocking ' +
        'the API domain (e.g. *.railway.app on some ISPs), or the API server is down/sleeping. ' +
        'Try (a) another network or mobile data, (b) deploying with a custom domain on the API, ' +
        'or (c) same-origin /api proxy (frontend/middleware.js + BACKEND_ORIGIN on Vercel).'
      );
    }
    if (r.status >= 500) return `⚠️ API answered with HTTP ${r.status}. Server is up but failing — check Railway logs.`;
    if (r.status === 404) return '⚠️ Got 404. The API URL is wrong, or you set REACT_APP_API_URL=/api without an active proxy.';
    if (r.status >= 400) return `⚠️ API answered ${r.status}. Reached server but auth/validation/CORS issue.`;
    return `Unknown state: ${fmt(r)}`;
  })();

  return (
    <div style={{ maxWidth: 900, margin: '24px auto', padding: 16, fontFamily: 'system-ui, sans-serif', color: '#222' }}>
      <h1 style={{ marginTop: 0 }}>Connection Diagnostics</h1>
      <p style={{ color: '#444' }}>
        Open this page from any device that has trouble logging in. It checks whether the browser can actually
        reach your API server and shows the real underlying error.
      </p>

      <div style={{ padding: 12, background: '#fff7d6', border: '1px solid #f1c40f', borderRadius: 8, marginBottom: 16 }}>
        <strong>Result:</strong> {loading ? 'Running…' : summary}
      </div>

      <Section title="App configuration">
        <Row label="Page origin" value={windowInfo?.pageOrigin} mono />
        <Row label="Page protocol" value={windowInfo?.pageProtocol} mono />
        <Row label="Build NODE_ENV" value={windowInfo?.buildEnv} />
        <Row label="REACT_APP_API_URL (build)" value={windowInfo?.buildEnvVar} mono />
        <Row label="Runtime override" value={windowInfo?.runtimeEnvVar} mono />
        <Row label="Resolved API base" value={resolvedBase || '(empty)'} mono />
        <Row label="Browser online?" value={windowInfo?.onLine} />
        <Row label="User agent" value={windowInfo?.userAgent} mono />
      </Section>

      <Section title="Probe: GET <resolved>/health">
        <Row label="URL" value={resolvedBase ? `${resolvedBase}/health` : '(no base)'} mono />
        <Row label="Status" value={results.same?.status ?? '—'} />
        <Row label="Status text" value={results.same?.statusText ?? '—'} />
        <Row label="Elapsed (ms)" value={results.same?.elapsedMs} />
        <Row label="Content-Type" value={results.same?.headers?.contentType} />
        <Row label="Access-Control-Allow-Origin" value={results.same?.headers?.cors} />
        <Row label="Server" value={results.same?.headers?.server} />
        <Row label="Network error" value={results.same?.error} />
        <Row label="Body (first 600 chars)" value={results.same?.body} mono />
      </Section>

      <Section title="Probe: CORS preflight (OPTIONS)">
        <Row label="Status" value={results.cors?.status ?? '—'} />
        <Row label="Allow-Origin in response" value={results.cors?.headers?.cors} />
        <Row label="Network error" value={results.cors?.error} />
      </Section>

      <Section title="Probe: external internet (httpbin.org)">
        <Row label="OK?" value={results.internet?.ok} />
        <Row label="Status" value={results.internet?.status ?? '—'} />
        <Row label="Network error" value={results.internet?.error} />
        <Row
          label="Interpretation"
          value={
            results.internet?.ok
              ? 'Internet works — failure is API-specific.'
              : 'External fetch fails too — device offline or restrictive corporate proxy.'
          }
        />
      </Section>

      <Section title="Try a different API URL (no rebuild)">
        <p style={{ marginTop: 0 }}>
          Paste a full URL (with or without <code>/api</code>) and re-run probes. Useful for testing a custom domain
          or alternate Railway URL from a problem device.
        </p>
        <input
          value={absInput}
          onChange={(e) => setAbsInput(e.target.value)}
          placeholder="https://your-api.example.com"
          style={{ width: '100%', padding: 8, fontFamily: 'monospace', borderRadius: 6, border: '1px solid #bbb' }}
        />
        <div style={{ marginTop: 8 }}>
          <button
            onClick={runProbes}
            disabled={loading}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 6,
              background: '#4f46e5',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {loading ? 'Probing…' : 'Re-run probes'}
          </button>
        </div>
        <Row label="Tested URL" value={absBase ? `${absBase}/health` : '(invalid)'} mono />
        <Row label="Status" value={results.abs?.status ?? '—'} />
        <Row label="Network error" value={results.abs?.error} />
        <Row label="Body" value={results.abs?.body} mono />
      </Section>

      <p style={{ color: '#666', fontSize: 12, marginTop: 24 }}>
        Tip: copy this page (or its visible content) when reporting an issue. It reveals far more than the generic
        "Network Error" message.
      </p>
    </div>
  );
};

export default Diagnostics;
