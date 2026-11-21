// ClickUp intake close back end, Netlify Function.
// POST-only. Marks intake tasks as closed in ClickUp once Triage has
// taken them, so they do not sit open in the Needs Triage list and are
// not pulled in again on the next sync.
// Close status: "complete". ClickUp lists the Needs Triage list statuses
// as "to do" (open), "planning", "in progress", "at risk",
// "update required", "on hold", "complete" (type done), and "cancelled"
// (type closed). "complete" is used here because it reads as "handled by
// Triage" rather than "thrown away". To close tasks as "cancelled"
// instead, change CLOSE_STATUS below to "cancelled"; nothing else in
// this file or in the front end needs to change.
// This function NEVER deletes a task. It only updates status with PUT.
// No token is stored in this file or in the repo. Set CLICKUP_API_TOKEN
// only in environment variables, in Netlify Site settings >
// Environment variables, or in a local .env file that is never committed.
// ClickUp API: PUT https://api.clickup.com/api/v2/task/{task_id}
// Rate limit: 100 requests per minute.
export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Use POST' }) };
  }
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) {
    return { statusCode: 501, body: JSON.stringify({ ok: false, error: 'ClickUp intake close is not configured. Set CLICKUP_API_TOKEN in Netlify environment variables.' }) };
  }
  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Request body must be JSON with {task_ids: [...]}.' }) };
  }
  const taskIds = body.task_ids;
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'task_ids must be a non-empty array of ClickUp task ids.' }) };
  }
  if (taskIds.length > 50) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'task_ids must have at most 50 ids per call.' }) };
  }
  for (const id of taskIds) {
    if (typeof id !== 'string' || !id.trim()) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Every task id must be a non-empty string.' }) };
    }
  }
  const CLOSE_STATUS = 'complete';
  const closed = [];
  const failed = [];
  for (const id of taskIds) {
    let res;
    try {
      res = await fetch('https://api.clickup.com/api/v2/task/' + encodeURIComponent(id), {
        method: 'PUT',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: CLOSE_STATUS })
      });
    } catch (err) {
      failed.push({ id, error: 'Could not reach ClickUp: ' + String(err && err.message ? err.message : err).slice(0, 200) });
      continue;
    }
    if (!res.ok) {
      failed.push({ id, error: clickUpErrorMessage(res.status) });
      continue;
    }
    closed.push(id);
  }
  return { statusCode: 200, body: JSON.stringify({ ok: true, closed, failed, close_status: CLOSE_STATUS }) };
}

function clickUpErrorMessage(status) {
  if (status === 401) return 'ClickUp rejected the API token. Check CLICKUP_API_TOKEN in Netlify environment variables.';
  if (status === 403) return 'ClickUp denied access to that task. Check that the token owner can access it.';
  if (status === 404) return 'ClickUp task was not found. It may already have been deleted in ClickUp.';
  if (status === 429) return 'ClickUp rate limit reached (100 requests per minute). Wait and retry.';
  return 'ClickUp returned status ' + status + '.';
}
