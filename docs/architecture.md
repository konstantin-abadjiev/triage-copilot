# Architecture

Triage is a working AI product management copilot, not a chatbot demo. It takes a messy, duplicate-filled backlog, clusters it, scores it with RICE and confidence, flags weak evidence, drafts a story for every scored item, and leaves the final call to a human.

## Overview

```
Browser (index.html)
  -> Netlify Functions (triage.mjs, clickup.mjs)
    -> OpenRouter (Claude, Gemini backup) for scoring and drafting
    -> Supabase Postgres for items, scores, decisions, evals, usage
    -> ClickUp API for approved tasks
```

The static demo in this repo runs the same triage logic in the browser with rules, so it works with no key and no back end. The real version keeps the same UI and swaps the browser logic for back end calls.

## Front end

- `index.html`: single page app, no build step. Industry pack dropdown in the header, to the right of About this demo, for Games, Healthcare, Fintech, and E-commerce, plus a Demo / Live mode toggle next to it (Demo is the default). Views: Backlog, Archived, navigated from a secondary section in the sticky action bar. The sticky action buttons, in order, are Run triage, ClickUp Import, CSV Import, CSV Template, Reload Demo. The stat cards show only on Backlog. Export Backlog CSV lives in its own card in the Backlog section, below the filters. Export Archived CSV lives in the Archived section. Backlog has Search, Theme, Target KPI, and Source filters over the whole list, with Theme and Source options drawn from the items in the current pack and KPI options from the pack's fixed list. The Backlog is stack-ranked by RICE after triage, with new unscored items at the top, then every scored item in RICE order, each with story and Approve / Edit / Reject on its card. Each scored card shows Reach, Impact, Effort, and Confidence; Demo Reach is labeled estimated. Backlog and Archived both show 10 items per page, with Previous / Next and page numbers.
- Loads `data/*.json` directly. Upload your own CSV with the same columns.
- Client-side triage in Demo mode: cluster by theme and normalized title, score RICE from Reach (theme table, see prompts/scoring.md), impact, effort, and confidence, assign one primary KPI per item from the pack's fixed KPI list (keyword match first, then theme map, then the first KPI of the list), flag low evidence, draft a story for every scored item. Demo costs a modeled $0.0192 per item, $0 real cost.
- Live mode: Run triage POSTs the unscored items to `netlify/functions/triage.mjs`, which calls the model and returns per-item Reach, RICE, KPI, story, and acceptance criteria plus the real per-token cost. The front end uses the model's values directly and never re-scores them. Every Live run asks for confirmation first. If the key is not configured, Live reports it and scores nothing.
- Decisions are kept in browser state in the demo, and a reload wipes them, along with scores, the archive, edits, uploads, and deletes. In the real version they are saved to Supabase via the back end.

## Demo vs Live

One app, one deploy, a mode toggle in the header. Default is Demo.

- Demo mode: rule-based scoring runs in the browser. Reach comes from
  a per-pack theme table (`prompts/scoring.md`), Confidence is fixed by
  evidence (85 / 65 / 40), and the cost is a modeled estimate of
  $0.0192 per item. Real cost is $0, no API key needed.
- Live mode: Run triage POSTs the unscored items to
  `netlify/functions/triage.mjs`, which calls Claude via OpenRouter and
  returns per-item Reach, RICE, KPI, story, and acceptance criteria,
  plus the real per-token cost from the usage object. The front end uses
  the model's values directly. Every Live run asks for confirmation
  first. If `OPENROUTER_API_KEY` is not set, the function returns
  `{ok:false, error:"Live scoring is not configured"}` and the front
  end shows "Live mode needs OPENROUTER_API_KEY set in Netlify" and
  scores nothing. The rule-based Demo scoring is never returned as a
  Live result.

Hookup checklist for the collaborator: the collaborator owns the
OpenRouter account and billing and the key. The key lives only in
Netlify environment variables, never in chat, email, or the repo. See
README.md for the steps. Supabase persistence is a separate later step.

## Back end

- All four functions require an `X-Triage-Secret` header matching
  `TRIAGE_SHARED_SECRET` (see `netlify/functions/lib/auth.mjs`).
  Missing or wrong secret: 401, and the function does nothing. Secret
  unset in the environment: 501, never accepted. The front end sends
  the header on every call; in `index.html` it is only the placeholder
  `__TRIAGE_SHARED_SECRET__`, replaced at deploy time by
  `scripts/build-deploy-zip.sh`. Honest limitation: the secret ships in
  client-side JavaScript, so anyone reading page source can copy it. It
  stops casual scans and random bots, it is not real authentication.
- `netlify/functions/triage.mjs`: Live mode only. Receives unscored items, calls OpenRouter (Claude Sonnet 4), validates the JSON output, and returns structured scores plus real token usage and cost. No API key means `{ok:false}` and no scores, never a rule-based fallback. Runs on Netlify Free: $0, 300 credits a month, enough for a demo.
- `netlify/functions/clickup.mjs`: receives an approved item, calls the ClickUp API, and returns the ClickUp task id.
- Alternative host: Railway, from the Lenny Product Pass, for the same functions if you prefer a long-running server.
- Keys live only in back end environment variables: `TRIAGE_SHARED_SECRET`, `OPENROUTER_API_KEY`, `CLICKUP_API_TOKEN`, `CLICKUP_LIST_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Never put a key in the browser, in chat, or in the repo.

## AI layer

- Primary model: Claude via OpenRouter, one API for many models. See `docs/setup-checklist.md`.
- Backup model: Gemini via Google AI Pro, $10 a month in Gemini API credits, with a $5 prepay to claim them.
- Model routing: a cheaper model for bulk triage of all 200 items per pack, a stronger model only for drafting stories and low-confidence second looks.
- Embeddings: a separate embeddings model for duplicate finding and for RAG retrieval of past decisions.
- Prompts: see `prompts/scoring.md`, `prompts/drafting.md`, and `prompts/clustering.md`. Prompts are stored in the repo and versioned, so a prompt change is a code change with an eval run. The scoring prompt also assigns one primary KPI per item from the pack's fixed KPI list, with a reason and a KPI confidence, and must never invent a KPI name outside the list.
- Structured output: the model must return strict JSON. The back end validates it, retries once on a bad response, and falls back to human review if it still fails.

## RAG

Past approved and rejected items are embedded and stored in Supabase with pgvector. For each new item, the back end pulls the 3 to 5 closest past items and includes them in the scoring prompt. That keeps scoring consistent over time, and it is what stops the same idea being scored differently on different days.

## Database

See `supabase/schema.sql`. Tables: packs, items, clusters, scores, decisions, eval_runs, usage_logs, decision_embeddings. Decisions are immutable: an approve or reject creates a decision row with a reason; editing a story updates the item, it does not create a decision row.

## Evals

Each pack has a 50-item ground truth set in `evals/*.json`. Targets: Healthcare 92%, Fintech 90%, Games 88%, E-commerce 94%. Run the same set on every prompt or model change. A version ships only if accuracy stays at or above its target and the wrong-theme rate does not rise. Results are stored in `eval_runs`.

## Guardrails

- PII redaction before any text reaches a model.
- Confidence cutoff: low-confidence items go to human review only, never auto-accept.
- JSON validation, score range checks, and theme checks before anything is shown.
- Human approval for high-risk items, especially compliance, fraud, safety, and payments.
- Audit trail for every approve and reject, with reviewer, time, and reason. Edited stories are kept on the item.
- Healthcare note: treat backlog text as if it could contain patient info. Redact it, do not send PHI to a model without a BAA, and keep demo data synthetic.

## Cost tracking

The model API returns input and output tokens per call. Multiply by the model price and log it in `usage_logs` per run, per item, and per pack. The Demo estimate is $0.0192 per item, or $3.84 per 200-item run at Claude-like pricing. A Live run shows the real cost from the function instead: the Cost / Run card reads "Real cost from the model" and the estimate label is replaced. Real cost replaces that estimate once the back end is live.

## ClickUp

When an item is approved, the back end can create a ClickUp task. See `docs/clickup-integration.md`. One list per industry pack, field mapping for RICE, theme, source, and confidence, and a queue so bulk approvals do not hit the ClickUp rate limit of 100 requests per minute.
