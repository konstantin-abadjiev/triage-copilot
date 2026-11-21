// Site-origin gate for the Triage Netlify functions.
// Every function imports authorize() and calls it first, before doing
// anything else: no ClickUp call, no OpenRouter call, no task close
// happens on an unauthorized request.
//
// The gate checks where the request came from, not a secret: it accepts
// only requests whose Origin header (falling back to Referer when Origin
// is absent) is the deployed site, triage-copilot.netlify.app, or one of
// its deploy previews (https://<anything>--triage-copilot.netlify.app).
// http://localhost and http://127.0.0.1 are also accepted, for local
// development only. Anything else — a wrong origin, or no origin and no
// referer at all — is refused with 403 and the function does nothing.
//
// This replaces the earlier shared-secret gate. That design baked the
// secret into index.html at deploy time, and Netlify's secrets scan
// rightly failed the deploy for it: a value shipped in client-side
// JavaScript is exposed by definition. No secret is used here at all,
// and no environment variable is read.
//
// Honest limitation: Origin and Referer headers can be spoofed by a
// determined caller, so this gate stops casual scans and random bots
// from spending OpenRouter money or writing to ClickUp, but it is a
// gate, not real authentication. A login is future work.
export function authorize(event) {
  const headers = (event && event.headers) || {};
  let raw = '';
  for (const key of Object.keys(headers)) {
    const lower = key.toLowerCase();
    if (lower === 'origin' || lower === 'referer') {
      const value = String(headers[key] || '').trim();
      if (value) { raw = value; break; }
    }
  }
  if (!raw) {
    return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'Forbidden' }) };
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'Forbidden' }) };
  }
  const host = url.hostname.toLowerCase();
  const isSite =
    url.protocol === 'https:' &&
    (host === 'triage-copilot.netlify.app' || host.endsWith('--triage-copilot.netlify.app'));
  const isLocal =
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    (host === 'localhost' || host === '127.0.0.1');
  if (!isSite && !isLocal) {
    return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'Forbidden' }) };
  }
  return null;
}
