# ClickUp integration

When an item is approved in Triage, the back end can create a task in ClickUp.

## Endpoint

```
POST https://api.clickup.com/api/v2/list/{list_id}/task
```

Headers:
- `Authorization: <CLICKUP_API_TOKEN>`
- `Content-Type: application/json`

## Token

For personal use, generate a Personal API Token in ClickUp:
1. Log in to ClickUp.
2. Click your avatar, then Settings.
3. Click Apps in the sidebar.
4. Under API Token, click Generate.
5. Copy the token, which begins with `pk_`, and store it as `CLICKUP_API_TOKEN` in the back end environment variables only.

For a shared app, use OAuth instead: create an app in ClickUp, get a client id and secret, and use the OAuth flow. Personal tokens are enough for this portfolio project.

## Lists

ClickUp hierarchy is Workspace, then Space, then Folder, then List, then Task. Use one List per industry pack, or one List with a custom field for Industry. Recommended lists:

- Triage, Healthcare, Meridian Ops
- Triage, Fintech, Northbeam Pay
- Triage, Games, Project Larkspur
- Triage, E-commerce, Marketlane

Set `CLICKUP_LIST_ID` per pack in the back end config. The list id is the number in the ClickUp list URL.

## Field mapping

| Triage field | ClickUp field |
| --- | --- |
| Title | Task name |
| User story plus acceptance criteria | Task description |
| RICE score | Custom field, number, or Priority mapped from RICE: 800 plus is Urgent, 500 to 799 is High, 200 to 499 is Normal, below 200 is Low |
| Theme | Custom field or tag |
| Source | Custom field |
| Confidence | Custom field, number |
| Evidence strength | Custom field |
| Pack | List, or custom field for Industry |
| Triage item id | Custom field, so the task links back to Triage |

Example body:

```json
{
  "name": "Online booking for follow-up visits",
  "description": "As a clinic manager, I want patients to book follow-up visits online, so that front desk calls drop.\n\nAcceptance criteria:\n- Given a booked patient, when they open the portal, then they can pick a follow-up slot.\n\nRICE: 136, Theme: Scheduling, Source: Customer request, Confidence: 85, Evidence: High",
  "status": "Open",
  "priority": 3
}
```

## Flow

1. User clicks Approve in the Review Queue.
2. Triage saves the decision to Supabase.
3. If the user chose "Send to ClickUp", or if auto-create is on, the back end calls the ClickUp API.
4. ClickUp returns a task id. Triage saves it in `decisions.clickup_task_id` and shows a link to the task.
5. If the call fails, Triage keeps the approval and shows the error, with a Retry button. It does not lose the decision.

## Rate limit

ClickUp has a 100 requests per minute limit. Approving one item at a time is fine. Approving a batch of 25 at once must be queued in the back end, a few calls per second, not all at once.

## No-code alternative

For a quick test, use n8n, in the Lenny Product Pass. Triage sends a webhook on Approve to n8n, and n8n creates the ClickUp task. Same result, less code, but less control over field mapping and retries. Use the direct API for the real version.
