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
// And it only closes tasks that belong to the intake list: every id is
// fetched first and checked against CLICKUP_INTAKE_LIST_ID, so a stray
// id from another list (for example the Triage Approved destination)
// is refused and never closed.
// No token is stored in this file or in the repo. Set CLICKUP_API_TOKEN
// only in environment variables, in Netlify Site settings >
// Environment variables, or in a local .env file that is never committed.
// Every call must also send the X-Triage-Secret header matching
// TRIAGE_SHARED_SECRET (see netlify/functions/lib/auth.mjs); without it
// the function returns 401 and does nothing.
// ClickUp API: PUT https://api.clickup.com/api/v2/task/{task_id}
// Rate limit: 100 requests per minute.
import { authorize } from './lib/auth.mjs';

export async function handler(event) {
  const denied = authorize(event);
  if (denied) return denied;
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Use POST' }) };
  }
  const token = process.env.CLICKUP_API_TOKEN;
  const intakeListId = process.env.CLICKUP_INTAKE_LIST_ID;
  if (!token || !intakeListId) {
    return { statusCode: 501, body: JSON.stringify({ ok: false, error: 'ClickUp intake close is not configured. Set CLICKUP_API_TOKEN and CLICKUP_INTAKE_LIST_ID in Netlify environment variables.' }) };
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
    // Fetch the task first and only close it when it belongs to the
    // intake list. Without this check, any task id handed to this
    // endpoint could be closed, including tasks from other lists.
    let taskListId = '';
    try {
      const getRes = await fetch('https://api.clickup.com/api/v2/task/' + encodeURIComponent(id), {
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000)
      });
      if (!getRes.ok) {
        let detail = '';
        try {
          const eb = await getRes.json();
          if (eb && typeof eb.err === 'string' && eb.err) detail = eb.err;
          else if (eb && typeof eb.message === 'string' && eb.message) detail = eb.message;
        } catch {}
        failed.push({ id, error: clickUpErrorMessage(getRes.status) + (detail ? ' ClickUp said: ' + detail.slice(0, 200) : '') });
        continue;
      }
      let task;
      try {
        task = await getRes.json();
      } catch {
        failed.push({ id, error: 'ClickUp returned an unreadable response for this task.' });
        continue;
      }
      // ClickUp returns the task's list as task.list.id; list_id is
      // checked as a fallback for API responses that flatten it.
      if (task && task.list && task.list.id != null) taskListId = String(task.list.id);
      else if (task && task.list_id != null) taskListId = String(task.list_id);
    } catch (err) {
      const timedOut = err && err.name === 'AbortError';
      failed.push({ id, error: timedOut ? 'ClickUp request timed out after 30s' : 'Could not reach ClickUp: ' + String(err && err.message ? err.message : err).slice(0, 200) });
      continue;
    }
    if (taskListId !== String(intakeListId)) {
      failed.push({ id, error: 'Task is not in the intake list (' + intakeListId + '), so it was not closed. This function only closes tasks from the Needs Triage intake list.' });
      continue;
    }
    let res;
    try {
      res = await fetch('https://api.clickup.com/api/v2/task/' + encodeURIComponent(id), {
        method: 'PUT',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: CLOSE_STATUS }),
        signal: AbortSignal.timeout(30000)
      });
    } catch (err) {
      const timedOut = err && err.name === 'AbortError';
      failed.push({ id, error: timedOut ? 'ClickUp request timed out after 30s' : 'Could not reach ClickUp: ' + String(err && err.message ? err.message : err).slice(0, 200) });
      continue;
    }
    if (!res.ok) {
      // Read the error body, so the real ClickUp message is reported.
      let detail = '';
      try {
        const eb = await res.json();
        if (eb && typeof eb.err === 'string' && eb.err) detail = eb.err;
        else if (eb && typeof eb.message === 'string' && eb.message) detail = eb.message;
      } catch {}
      failed.push({ id, error: clickUpErrorMessage(res.status) + (detail ? ' ClickUp said: ' + detail.slice(0, 200) : '') });
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
