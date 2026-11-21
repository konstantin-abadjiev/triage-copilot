// Shared-secret gate for the Triage Netlify functions.
// Every function imports authorize() and calls it first, before doing
// anything else: no ClickUp call, no OpenRouter call, no task close
// happens on an unauthorized request.
//
// The secret is the TRIAGE_SHARED_SECRET Netlify environment variable.
// The front end sends it as the X-Triage-Secret header; the deploy
// build injects the real value into index.html at ZIP time (see
// scripts/build-deploy-zip.sh). The value is never committed, never
// logged, and never appears in an error message.
//
// Honest limitation: the secret is shipped in client-side JavaScript,
// so anyone who reads the page source can copy it. This gate stops
// casual scans and random bots from spending OpenRouter money or
// writing to ClickUp. It is not real authentication; a login is
// future work.
import { createHash, timingSafeEqual } from 'node:crypto';

export const TRIAGE_SECRET_HEADER = 'x-triage-secret';

// Returns null when the request is authorized. Otherwise returns the
// response object the handler should return verbatim.
export function authorize(event) {
  const expected = process.env.TRIAGE_SHARED_SECRET;
  if (!expected) {
    // Never accept a request when no secret is configured: an unset
    // secret must fail closed, not open.
    return { statusCode: 501, body: JSON.stringify({ ok: false, error: 'Shared secret is not configured. Set TRIAGE_SHARED_SECRET in Netlify environment variables.' }) };
  }
  const headers = (event && event.headers) || {};
  let provided = '';
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === TRIAGE_SECRET_HEADER) {
      provided = String(headers[key] || '');
      break;
    }
  }
  // Compare SHA-256 digests with timingSafeEqual, so the comparison
  // runs in constant time regardless of the secret's length, and a
  // length difference does not leak through timing.
  const expectedHash = createHash('sha256').update(expected).digest();
  const providedHash = createHash('sha256').update(provided).digest();
  if (!timingSafeEqual(expectedHash, providedHash)) {
    return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'Unauthorized' }) };
  }
  return null;
}
