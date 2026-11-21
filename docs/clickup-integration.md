# ClickUp integration

Auto-create on Approve. When an item is approved in the Backlog, Triage
automatically creates one task in ClickUp. Edit and Reject never create a
task. There is no separate Send to ClickUp button. The only manual ClickUp
button is a retry that appears after a failed create.

## Flow

1. User clicks Approve in the Backlog and gives a reason.
2. Triage holds the typed reason and reviewer on the item and shows
   "Creating ClickUp task...". No decision is recorded yet.
3. The front end POSTs to `/.netlify/functions/clickup` with
   `{item, pack, decision: "approved", reviewer, reason}`.
4. The Netlify Function `netlify/functions/clickup.mjs` resolves the List ID
   for that pack, builds the task, and calls the ClickUp API.
5. ClickUp returns a task id and URL. Triage stores them on the approved
   item and in the decision record, and shows an "Open task" link.
6. If the call fails, the item stays pending in the inbox with its
   Approve, Edit, and Reject buttons still enabled and a
   "ClickUp failed, retry" button. The typed reason is kept for the
   retry, and no decision is recorded until the task is created.

## Idempotency

Only call the function on Approve, never on Edit or Reject, and never retry
a 201 success. A second POST for the same approved item would create a
duplicate task, because the ClickUp API has no idempotency key. The retry
button only appears after a failed create, and it is disabled after a
success. The function also rejects any request whose `decision` is not
`"approved"`.

## Endpoint

The front end calls the Netlify Function, never ClickUp directly. The token
never reaches the browser.

```
POST /.netlify/functions/clickup
```

Request body:

```json
{
  "item": {
    "id": "HEA-001",
    "title": "Online booking for follow-up visits",
    "story": "As a clinic manager, I want ...",
    "description": "Patients want to book online instead of calling.",
    "acceptance": ["Given a user in this workflow, ..."],
    "rice": 136,
    "theme": "Scheduling",
    "source": "Customer request",
    "requester_type": "Clinic manager",
    "confidence": 85,
    "evidence_strength": "High"
  },
  "pack": "healthcare",
  "decision": "approved",
  "reviewer": "konstantin-abadjiev",
  "reason": "Meets the bar, evidence is clear."
}
```

Success response:

```json
{
  "ok": true,
  "task_id": "<TASK_ID>",
  "task_url": "https://app.clickup.com/t/<TASK_ID>",
  "list_id": "<LIST_ID>"
}
```

Error response:

```json
{
  "ok": false,
  "error": "ClickUp list was not found. Check CLICKUP_LIST_ID for this pack.",
  "clickup_status": 404
}
```

The function maps ClickUp failures to plain messages, with no token in any
error. 401 means the token was rejected. 403 means the token owner cannot
access the list. 404 means the list was not found. 429 means the rate limit
was reached. Other upstream failures return 502.

## Two-list setup: intake source and approved destination

Triage uses two different ClickUp lists. Mixing them up would send
approved tasks straight back into the inbox as new items.

- Intake list, the source: `CLICKUP_INTAKE_LIST_ID`. Bugs are filed here,
  and new feature ideas are added here. The front end "ClickUp Import"
  button pulls tasks from this list only, through
  `GET /.netlify/functions/clickup-intake`, and appends them to the pack
  you are currently viewing. It never creates tasks here.
  Configured Nov 20, 2026: "Needs Triage", List ID 1700370000001077,
  in folder Backlog Triage Copilot, Product space. Set
  `CLICKUP_INTAKE_LIST_ID=1700370000001077` in Netlify environment variables.
- Approved list, the destination: `CLICKUP_LIST_ID`, or a per-pack
  `CLICKUP_LIST_ID_<PACK>`. Approving an item in the Backlog creates
  one task here, through `POST /.netlify/functions/clickup`. Nothing is
  ever read back from this list as new input.
  Configured Nov 20, 2026: "Triage Approved", List ID 1700370000001073,
  same folder. Set `CLICKUP_LIST_ID=1700370000001073`. The Backlog and
  Archived descriptions link to this list at
  https://app.clickup.com/9009062684/v/l/1700370000001073, so a user
  deciding on items can open where approved items export to.

Both lists now exist in ClickUp. Set both IDs above in Netlify
environment variables and redeploy before Sync from ClickUp will work.
Until then, Sync returns a clear 501 "not configured" error and adds
nothing.

## Inbox and Archived flow

New items arrive by CSV upload or by ClickUp sync, and are appended to the
active inbox, never replacing it. They are deduped by item id, by
ClickUp task id when present, and by title + description, across the
inbox, the scored queue, the archive, and deleted-item tombstones, so
re-uploading or re-syncing the same items adds 0 new items.

Each item has a lifecycle: new, then triaged once it has been scored. A
scored item is pending until it is approved or rejected, and decided
items move to Archived.
Backlog shows only active inbox items, new plus
triaged plus undecided. Run triage scores only items that have not been
scored yet, so undecided items keep their score and place, and decided
items are never re-scored. The status line shows "New since last triage".

- Approve: creates the ClickUp task first. Only on success does the item
  move to Archived, keeping its ClickUp task link. On failure it stays in
  the inbox with a retry button.
- Edit: updates the story in place. The item stays in the Backlog, still undecided, until it is approved or rejected. Edit never calls the API and never archives the item.
- Reject: the item moves to Archived immediately, with its reason kept.
  No ClickUp call is made.

The Archived view lists every approved and rejected item, with
its decision, reason, timestamp, RICE, theme, and ClickUp task link when
present. The Decisions Logged stat counts archived items. A failed Approve
attempt stays pending in the inbox with a retry button; no decision is
recorded until the ClickUp task is created.

## Intake endpoint

```
GET /.netlify/functions/clickup-intake
```

Success response:

```json
{
  "ok": true,
  "items": [
    {
      "id": "<CLICKUP_TASK_ID>",
      "title": "Task name",
      "description": "Task description",
      "source": "ClickUp intake",
      "requester_type": "Internal request",
      "theme": "Intake",
      "impact": 5,
      "effort": 5,
      "risk": "Low",
      "evidence_strength": "Medium",
      "clickup_task_id": "<CLICKUP_TASK_ID>",
      "clickup_task_url": "https://app.clickup.com/t/<CLICKUP_TASK_ID>"
    }
  ],
  "count": 1,
  "list_id": "<INTAKE_LIST_ID>"
}
```

Mapping: the ClickUp task id is the Triage item id, the task name is the
title, the task description is the description, the source is always
"ClickUp intake", the theme is the first tag name when the task has tags
and "Intake" otherwise, the requester comes from a custom field named
Requester or Reporter when present and is "Internal request" otherwise,
and impact, effort, risk, and evidence default to 5, 5, Low, and Medium,
because intake tasks do not carry RICE inputs yet. Triage scores them on
the next run.

If `CLICKUP_API_TOKEN` or `CLICKUP_INTAKE_LIST_ID` is missing, the
function returns 501 with a plain "not configured" message, never a
token. 401, 403, 404, and 429 are mapped to plain messages, as in the
create function above.

## Close on intake

Once Triage has taken an item from the intake list, its ClickUp task is
closed in ClickUp, not deleted. Closing it is what stops it sitting open
in Needs Triage and being pulled in again on the next sync.

- After a successful sync, the front end calls
  `POST /.netlify/functions/clickup-intake-close` with only the task ids
  that were genuinely new in that sync. Items already seen or already
  archived are never closed by this call.
- The close function (`netlify/functions/clickup-intake-close.mjs`) fetches
  each task first and only closes it when it belongs to the intake list
  (`CLICKUP_INTAKE_LIST_ID`). An id from another list is refused and
  reported in `failed`; nothing from another list is ever closed. It then
  calls `PUT https://api.clickup.com/api/v2/task/{task_id}` with
  `{status: "complete"}` for each id, and returns
  `{ok, closed: [...], failed: [{id, error}]}`. A task that fails to close
  is reported in `failed` and the rest still close; one failure does not
  fail the whole batch.
- Close status is "complete". The Needs Triage list statuses are "to do"
  (open), "planning", "in progress", "at risk", "update required",
  "on hold", "complete" (type done), and "cancelled" (type closed).
  "complete" is used because it reads as "handled by Triage" rather than
  "thrown away". To close tasks as "cancelled" instead, change
  `CLOSE_STATUS` in `clickup-intake-close.mjs` to "cancelled"; nothing
  else needs to change.
- Tasks are never deleted by Triage, only marked complete. The closed
  task stays in ClickUp as a record, and its link is kept on the Triage
  item.
- If closing fails, the items stay in the Triage inbox, nothing is rolled
  back, and there is no automatic retry. The status line says "Synced N
  new items, could not close M in ClickUp, they will be skipped as
  duplicates next time", because the next sync skips them by id anyway.
  On success it says "Synced N new items, closed N in ClickUp".

The function calls:

```
POST https://api.clickup.com/api/v2/list/{list_id}/task
```

Headers:
- `Authorization: <CLICKUP_API_TOKEN>`
- `Content-Type: application/json`

## Token

Generate a Personal API Token in ClickUp:
1. Log in to ClickUp.
2. Click your avatar, then Settings.
3. Click Apps in the sidebar.
4. Under API Token, click Generate.
5. Copy the token, which begins with `pk_`, and store it as
   `CLICKUP_API_TOKEN` in the back end environment variables only. Never
   put it in the repo, in a file, or in chat.

For a shared app, use OAuth instead: create an app in ClickUp, get a client
id and secret, and use the OAuth flow. Personal tokens are enough for this
portfolio project.

## Environment variables

Set these in Netlify, not in the repo:

1. Open the Netlify site, then Site settings, then Environment variables.
2. Add `CLICKUP_API_TOKEN` with the personal token.
3. Add `CLICKUP_LIST_ID` with the default List ID.
4. Add `CLICKUP_INTAKE_LIST_ID` with the intake source List ID
   ("Needs Triage", 1700370000001077). Until it is set, Sync from
   ClickUp reports it as not configured.
5. Optionally add one List ID per pack. Each falls back to
   `CLICKUP_LIST_ID` when it is not set:
   - `CLICKUP_LIST_ID_HEALTHCARE`
   - `CLICKUP_LIST_ID_FINTECH`
   - `CLICKUP_LIST_ID_GAMES`
   - `CLICKUP_LIST_ID_ECOMMERCE`
6. Redeploy the site so the new variables reach the function.

For local work, copy `.env.example` to `.env` and fill in the same names.
Never commit a real `.env` file.

## Finding a List ID

1. Open the List in ClickUp.
2. Look at the URL. The List ID is the number at the end of the URL, for
   example `https://app.clickup.com/<WORKSPACE_ID>/v/li/<LIST_ID>` has List
   ID `<LIST_ID>`.
3. Use one List per industry pack, or one List with a custom field for
   Industry. Recommended lists:
   - Triage, Healthcare, Grekon Health
   - Triage, Fintech, Grekon Financial
   - Triage, Games, Grekon Games
   - Triage, E-commerce, Grekon Market

ClickUp hierarchy is Workspace, then Space, then Folder, then List, then
Task.

## Field mapping

| Triage field | ClickUp field |
| --- | --- |
| Title | Task name |
| User story plus acceptance criteria, RICE, theme, source, requester, confidence, evidence, pack, Triage item id, approval reason, reviewer | Task description |
| RICE score | Priority, mapped from RICE: 250 plus is Urgent (1), 150 to 249 is High (2), 100 to 149 is Normal (3), below 100 is Low (4) |
| Theme and pack | Task description (themes and pack names are not ClickUp tags, so none are sent) |
| Custom fields, only if the approved item carries them | Custom fields, passed through as given |
| Pack | List, resolved from the per-pack List ID, or the shared List ID |
| Triage item id | Included in the description, so the task links back to Triage |

Example task body sent to ClickUp:

```json
{
  "name": "Online booking for follow-up visits",
  "description": "As a clinic manager, I want patients to book follow-up visits online, so that front desk calls drop.\n\nAcceptance criteria:\n- Given a booked patient, when they open the portal, then they can pick a follow-up slot.\n\nRICE: 136, Theme: Scheduling, Source: Customer request, Confidence: 85, Evidence: High\n\nApproved by: konstantin-abadjiev\nApproval reason: Meets the bar, evidence is clear.",
  "status": "to do",
  "priority": 3
}
```

## Rate limit

ClickUp has a 100 requests per minute limit. Approving one item at a time
is fine. Approving a batch of 25 at once must be queued in the back end,
a few calls per second, not all at once.

## No-code alternative

For a quick test, use n8n, in the Lenny Product Pass. Triage sends a
webhook on Approve to n8n, and n8n creates the ClickUp task. Same result,
less code, but less control over field mapping and retries. Use the direct
API for the real version.
