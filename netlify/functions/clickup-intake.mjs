// ClickUp intake back end, Netlify Function.
// GET-only. Reads new bugs and feature ideas from a separate ClickUp
// intake list and returns them as Triage items, so the front end can
// append them to the inbox without duplicates.
// This is the SOURCE list. Approved items go to a DIFFERENT list,
// the destination, via netlify/functions/clickup.mjs. Keeping the two
// lists separate is what stops approved tasks flowing back in as new.
// No token or List ID is stored in this file or in the repo. Set them
// only in environment variables, in Netlify Site settings >
// Environment variables, or in a local .env file that is never committed.
// Every call must also send the X-Triage-Secret header matching
// TRIAGE_SHARED_SECRET (see netlify/functions/lib/auth.mjs); without it
// the function returns 401 and does nothing.
// ClickUp API: GET https://api.clickup.com/api/v2/list/{list_id}/task
// Rate limit: 100 requests per minute.
import { authorize } from './lib/auth.mjs';

export async function handler(event) {
  const denied = authorize(event);
  if (denied) return denied;
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Use GET' }) };
  }
  const token = process.env.CLICKUP_API_TOKEN;
  const listId = process.env.CLICKUP_INTAKE_LIST_ID;
  if (!token || !listId) {
    return { statusCode: 501, body: JSON.stringify({ ok: false, error: 'ClickUp intake is not configured. Set CLICKUP_API_TOKEN and CLICKUP_INTAKE_LIST_ID in Netlify environment variables. The intake list is the source list for bugs and new feature ideas; it is not the approved destination list.' }) };
  }
  const items = [];
  let page = 0;
  // ClickUp pages task lists. Loop a bounded number of pages so a large
  // intake list does not run forever.
  for (; page < 10; page++) {
    let res;
    try {
      res = await fetch('https://api.clickup.com/api/v2/list/' + encodeURIComponent(listId) + '/task?archived=false&page=' + page, {
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000)
      });
    } catch (err) {
      const timedOut = err && err.name === 'AbortError';
      return { statusCode: 502, body: JSON.stringify({ ok: false, error: timedOut ? 'ClickUp request timed out after 30s' : 'Could not reach ClickUp', detail: String(err && err.message ? err.message : err).slice(0, 200) }) };
    }
    if (!res.ok) {
      // Read the error body, so the real ClickUp message reaches the user.
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
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    // ClickUp returns complete tasks in this list too, even with
    // archived=false, so skip tasks that are already done or closed
    // here. Dedup in the front end is the second guard, this is the first.
    tasks.forEach(function (t) {
      const st = (t && t.status && t.status.status) || '';
      const type = (t && t.status && t.status.type) || '';
      if (st === 'complete' || st === 'cancelled' || type === 'done' || type === 'closed') return;
      items.push(mapTask(t));
    });
    if (data.last_page !== false) break;
    if (!tasks.length) break;
  }
  return { statusCode: 200, body: JSON.stringify({ ok: true, items, count: items.length, list_id: listId }) };
}

function clickUpErrorMessage(status) {
  if (status === 401) return 'ClickUp rejected the API token. Check CLICKUP_API_TOKEN in Netlify environment variables.';
  if (status === 403) return 'ClickUp denied access to the intake list. Check that the token owner can access the list.';
  if (status === 404) return 'ClickUp intake list was not found. Check CLICKUP_INTAKE_LIST_ID in Netlify environment variables.';
  if (status === 429) return 'ClickUp rate limit reached (100 requests per minute). Wait and retry.';
  return 'ClickUp returned status ' + status + '.';
}

// One ClickUp task becomes one Triage item. The ClickUp task id is the
// Triage item id, so a second sync of the same task is skipped as a
// duplicate by the front end dedup, and an archived item never returns.
function mapTask(task) {
  const tags = Array.isArray(task.tags) ? task.tags : [];
  const theme = tags.length && tags[0] && tags[0].name ? tags[0].name : 'Intake';
  const requester = requesterFromCustomFields(task) || (task.creator && task.creator.username) || 'Internal request';
  const source = sourceFromCustomFields(task) || 'ClickUp intake';
  return {
    id: String(task.id),
    title: task.name || 'Untitled ClickUp task',
    description: task.description || task.text_content || task.name || '',
    source,
    requester_type: requester,
    theme,
    impact: 5,
    effort: 5,
    risk: 'Low',
    evidence_strength: 'Medium',
    clickup_task_id: String(task.id),
    clickup_task_url: task.url || null
  };
}

// The intake list has a custom field named "Source", type labels, with
// options Bug, Feature Idea, and Customer Request. Its value is an array
// of option ids, so resolve the id through type_config.options to the
// label and use that label as the Triage source, so what the user picked
// in ClickUp is what Triage shows.
function sourceFromCustomFields(task) {
  const fields = Array.isArray(task.custom_fields) ? task.custom_fields : [];
  for (const f of fields) {
    const name = String((f && f.name) || '').toLowerCase();
    if (name !== 'source') continue;
    const options = (f.type_config && Array.isArray(f.type_config.options)) ? f.type_config.options : [];
    const values = Array.isArray(f.value) ? f.value : (f.value != null ? [f.value] : []);
    for (const v of values) {
      const opt = options.find(function (o) { return String(o.id) === String(v); });
      if (opt && opt.label) return String(opt.label);
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return '';
}

function requesterFromCustomFields(task) {
  const fields = Array.isArray(task.custom_fields) ? task.custom_fields : [];
  for (const f of fields) {
    const name = String((f && f.name) || '').toLowerCase();
    if (name.indexOf('requester') !== -1 || name.indexOf('reporter') !== -1) {
      if (f.value != null && String(f.value).trim()) return String(f.value).trim();
    }
  }
  return '';
}
