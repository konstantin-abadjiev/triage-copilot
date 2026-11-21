// ClickUp back end, Netlify Function.
// Auto-create on Approve only. Edit and Reject never call this function.
// The front end calls this endpoint after a user approves an item in the
// Review. The function creates one ClickUp task and returns its id
// and URL. No token or List ID is stored in this file or in the repo.
// Set them only in environment variables, in Netlify Site settings >
// Environment variables, or in a local .env file that is never committed.
// ClickUp API: POST https://api.clickup.com/api/v2/list/{list_id}/task
// Rate limit: 100 requests per minute. Approving one item at a time is
// fine. A batch approve must be queued, a few calls per second.
//
// Idempotency guard: only call this function on Approve, never on Edit
// or Reject, and never retry a 201 success. The front end stores the
// returned task_id on the approved item and the retry button only appears
// after a failed create. A second POST for the same approved item would
// create a duplicate task, because the ClickUp API has no idempotency key.
export async function handler(event) {
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
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'ClickUp is not configured. Set CLICKUP_API_TOKEN and CLICKUP_LIST_ID (or a per-pack CLICKUP_LIST_ID_<PACK>) in Netlify environment variables.' }) };
  }
  const task = buildTask(item, pack);
  let res;
  try {
    res = await fetch('https://api.clickup.com/api/v2/list/' + encodeURIComponent(listId) + '/task', {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: JSON.stringify(task)
    });
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ ok: false, error: 'Could not reach ClickUp', detail: String(err && err.message ? err.message : err).slice(0, 200) }) };
  }
  if (!res.ok) {
    return { statusCode: res.status === 429 ? 429 : 502, body: JSON.stringify({ ok: false, error: clickUpErrorMessage(res.status), clickup_status: res.status }) };
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
// 2 high, 3 normal, 4 low. The top RICE band is urgent, the next is high,
// then normal, then low. These bands match docs/clickup-integration.md.
function priorityForRice(rice) {
  const n = Number(rice) || 0;
  if (n >= 800) return 1;
  if (n >= 500) return 2;
  if (n >= 200) return 3;
  return 4;
}

function clickUpErrorMessage(status) {
  if (status === 401) return 'ClickUp rejected the API token. Check CLICKUP_API_TOKEN in Netlify environment variables.';
  if (status === 403) return 'ClickUp denied access to this list. Check that the token owner can access the list.';
  if (status === 404) return 'ClickUp list was not found. Check CLICKUP_LIST_ID for this pack.';
  if (status === 429) return 'ClickUp rate limit reached (100 requests per minute). Wait and retry.';
  return 'ClickUp returned status ' + status + '.';
}

function buildTask(item, pack) {
  const rice = Number(item.rice) || 0;
  const acceptance = Array.isArray(item.acceptance) ? item.acceptance : [];
  const lines = [];
  lines.push(item.story || item.description || item.title);
  lines.push('');
  lines.push('Acceptance criteria:');
  acceptance.forEach(function (a) { lines.push('- ' + a); });
  lines.push('');
  lines.push('RICE: ' + rice);
  lines.push('Theme: ' + (item.theme || ''));
  lines.push('Source: ' + (item.source || ''));
  lines.push('Requester: ' + (item.requester_type || ''));
  lines.push('Confidence: ' + (item.confidence != null ? item.confidence + '%' : ''));
  lines.push('KPI: ' + (item.kpi || ''));
  if (item.kpi_reason) lines.push('KPI reason: ' + item.kpi_reason);
  lines.push('Evidence strength: ' + (item.evidence_strength || ''));
  lines.push('Pack: ' + (pack || ''));
  lines.push('Triage item id: ' + (item.id || ''));
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
