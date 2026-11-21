// ClickUp back end stub, Netlify Function.
// Receives an approved item, creates a ClickUp task, returns the task id.
// Set CLICKUP_API_TOKEN and CLICKUP_LIST_ID in Netlify environment variables.
// No real token is included in this repo.
// ClickUp API: POST https://api.clickup.com/api/v2/list/{list_id}/task
// Rate limit: 100 requests per minute, queue bulk approvals.
export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Use POST' }) };
  }
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }
  const token = process.env.CLICKUP_API_TOKEN;
  const listId = body.list_id || process.env.CLICKUP_LIST_ID;
  if (!token || !listId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'CLICKUP_API_TOKEN and CLICKUP_LIST_ID are required. Set them in Netlify environment variables.', would_create: buildTask(body) }) };
  }
  const task = buildTask(body);
  const res = await fetch('https://api.clickup.com/api/v2/list/' + encodeURIComponent(listId) + '/task', {
    method: 'POST',
    headers: { 'Authorization': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(task)
  });
  if (!res.ok) {
    const text = await res.text();
    return { statusCode: 502, body: JSON.stringify({ error: 'ClickUp error', status: res.status, detail: text.slice(0, 500) }) };
  }
  const data = await res.json();
  return { statusCode: 200, body: JSON.stringify({ clickup_task_id: data.id, url: data.url || null }) };
}

function buildTask(b) {
  const rice = b.rice || 0;
  const priority = rice >= 800 ? 1 : rice >= 500 ? 2 : rice >= 200 ? 3 : 4;
  const desc = (b.story || b.title || '') + '\n\nAcceptance criteria:\n' + (b.acceptance || []).map(function (a) { return '- ' + a; }).join('\n') + '\n\nRICE: ' + rice + ', Theme: ' + (b.theme || '') + ', Source: ' + (b.source || '') + ', Confidence: ' + (b.confidence || '') + ', Evidence: ' + (b.evidence_strength || '');
  return { name: b.title || 'Triage item', description: desc, status: 'Open', priority };
}
