// ClickUp back end, Netlify Function.
// Auto-create on Approve only. Edit and Reject never call this function.
// The front end calls this endpoint after a user approves an item in the
// Backlog. The function creates one ClickUp task and returns its id
// and URL. No token or List ID is stored in this file or in the repo.
// Set them only in environment variables, in Netlify Site settings >
// Environment variables, or in a local .env file that is never committed.
// Every call must also send the X-Triage-Secret header matching
// TRIAGE_SHARED_SECRET (see netlify/functions/lib/auth.mjs); without it
// the function returns 401 and does nothing.
// ClickUp API: POST https://api.clickup.com/api/v2/list/{list_id}/task
// Rate limit: 100 requests per minute. Approving one item at a time is
// fine. A batch approve must be queued, a few calls per second.
//
// Idempotency guard: only call this function on Approve, never on Edit
// or Reject, and never retry a 201 success. The front end stores the
// returned task_id on the approved item and the retry button only appears
// after a failed create. A second POST for the same approved item would
// create a duplicate task, because the ClickUp API has no idempotency key.
import { authorize } from './lib/auth.mjs';

export async function handler(event) {
  const denied = authorize(event);
  if (denied) return denied;
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Use POST' }) };
  }
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) };
  }
  // Only Approve creates a task. Anything else is rejected here, even if
  // the front end ever sends it by mistake.
  if (body.decision !== 'approved') {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Only decision "approved" creates a ClickUp task. Edit and Reject do not.' }) };
  }
  const item = body.item || {};
  if (!item.title || typeof item.title !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'item.title is required' }) };
  }
  const pack = typeof body.pack === 'string' ? body.pack.toLowerCase() : '';
  const token = process.env.CLICKUP_API_TOKEN;
  const listId = resolveListId(pack);
  if (!token || !listId) {
    return { statusCode: 501, body: JSON.stringify({ ok: false, error: 'ClickUp is not configured. Set CLICKUP_API_TOKEN and CLICKUP_LIST_ID (or a per-pack CLICKUP_LIST_ID_<PACK>) in Netlify environment variables.' }) };
  }
  const task = buildTask(item, pack, body.reviewer, body.reason);
  let res;
  try {
    res = await fetch('https://api.clickup.com/api/v2/list/' + encodeURIComponent(listId) + '/task', {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
      signal: AbortSignal.timeout(30000)
    });
  } catch (err) {
    const timedOut = err && err.name === 'AbortError';
    return { statusCode: 502, body: JSON.stringify({ ok: false, error: timedOut ? 'ClickUp request timed out after 30s' : 'Could not reach ClickUp', detail: String(err && err.message ? err.message : err).slice(0, 200) }) };
  }
  if (!res.ok) {
    // Read the error body: ClickUp's own message says what actually
    // failed, instead of only a status code reaching the user.
    let detail = '';
    try {
      const eb = await res.json();
      if (eb && typeof eb.err === 'string' && eb.err) detail = eb.err;
      else if (eb && typeof eb.message === 'string' && eb.message) detail = eb.message;
    } catch {}
    return { statusCode: res.status === 429 ? 429 : 502, body: JSON.stringify({ ok: false, error: clickUpErrorMessage(res.status) + (detail ? ' ClickUp said: ' + detail.slice(0, 200) : ''), clickup_status: res.status }) };
  }
  let data;
  try {
    data = await res.json();
  } catch {
    return { statusCode: 502, body: JSON.stringify({ ok: false, error: 'ClickUp returned an unreadable response' }) };
  }
  if (!data.id) {
    return { statusCode: 502, body: JSON.stringify({ ok: false, error: 'ClickUp did not return a task id' }) };
  }
  return { statusCode: 200, body: JSON.stringify({ ok: true, task_id: data.id, task_url: data.url || null, list_id: listId }) };
}

// Per-pack List ID, falling back to the shared CLICKUP_LIST_ID.
// Pack keys are healthcare, fintech, games, ecommerce.
function resolveListId(pack) {
  const byPack = {
    healthcare: process.env.CLICKUP_LIST_ID_HEALTHCARE,
    fintech: process.env.CLICKUP_LIST_ID_FINTECH,
    games: process.env.CLICKUP_LIST_ID_GAMES,
    ecommerce: process.env.CLICKUP_LIST_ID_ECOMMERCE
  };
  return byPack[pack] || process.env.CLICKUP_LIST_ID || '';
}

// Priority is mapped from RICE. ClickUp priority values are 1 urgent,
// 2 high, 3 normal, 4 low. The bands match the real RICE range with
// Reach in the formula: simulated per-pack maxima are Games 268,
// Healthcare 344, Fintech 408, E-commerce 536, so Urgent at 250 and
// High at 150 are reachable in every pack (Urgent: 2, 6, 5, 9 items;
// High: 22, 22, 31, 43 items), Normal at 100 covers the middle of each
// pack, and the rest are Low. These bands match docs/clickup-integration.md.
function priorityForRice(rice) {
  const n = Number(rice) || 0;
  if (n >= 250) return 1;
  if (n >= 150) return 2;
  if (n >= 100) return 3;
  return 4;
}

function clickUpErrorMessage(status) {
  if (status === 401) return 'ClickUp rejected the API token. Check CLICKUP_API_TOKEN in Netlify environment variables.';
  if (status === 403) return 'ClickUp denied access to this list. Check that the token owner can access the list.';
  if (status === 404) return 'ClickUp list was not found. Check CLICKUP_LIST_ID for this pack.';
  if (status === 429) return 'ClickUp rate limit reached (100 requests per minute). Wait and retry.';
  return 'ClickUp returned status ' + status + '.';
}

function buildTask(item, pack, reviewer, reason) {
  const rice = Number(item.rice) || 0;
  const acceptance = Array.isArray(item.acceptance) ? item.acceptance : [];
  const lines = [];
  lines.push(item.story || item.description || item.title);
  lines.push('');
  lines.push('Acceptance criteria:');
  acceptance.forEach(function (a) { lines.push('- ' + a); });
  lines.push('');
  lines.push('RICE: ' + rice);
  lines.push('Reach: ' + (item.reach != null ? item.reach + ' (1-10)' : ''));
  lines.push('Impact: ' + (item.impact != null ? item.impact : ''));
  lines.push('Effort: ' + (item.effort != null ? item.effort : ''));
  lines.push('Theme: ' + (item.theme || ''));
  lines.push('Source: ' + (item.source || ''));
  lines.push('Requester: ' + (item.requester_type || ''));
  lines.push('Confidence: ' + (item.confidence != null ? item.confidence + '%' : ''));
  lines.push('KPI: ' + (item.kpi || ''));
  if (item.kpi_reason) lines.push('KPI reason: ' + item.kpi_reason);
  lines.push('Evidence strength: ' + (item.evidence_strength || ''));
  lines.push('Pack: ' + (pack || ''));
  lines.push('Triage item id: ' + (item.id || ''));
  // The approval reason and reviewer travel with the task, so ClickUp
  // shows why this item was approved and by whom.
  if (reviewer) lines.push('Approved by: ' + reviewer);
  if (reason) lines.push('Approval reason: ' + reason);
  const task = {
    name: item.title,
    description: lines.join('\n'),
    status: 'to do',
    priority: priorityForRice(rice)
  };
  // Pass through custom fields only if the approved item carries them.
  // They must already exist on the ClickUp list, with matching field ids.
  if (Array.isArray(item.custom_fields) && item.custom_fields.length) {
    task.custom_fields = item.custom_fields;
  }
  // No tags are sent. ClickUp only accepts tags that already exist in
  // the space, and Triage themes and pack names are not ClickUp tags, so
  // sending them could fail the create. Theme and pack are already in
  // the task description above.
  return task;
}
