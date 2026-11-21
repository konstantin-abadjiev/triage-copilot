# Architecture

Triage is a working AI product management copilot, not a chatbot demo. It takes a messy, duplicate-filled backlog, clusters it, scores it with RICE and confidence, flags weak evidence, drafts stories for the top items, and leaves the final call to a human.

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

- `index.html`: single page app, no build step. Industry pack dropdown in the header, to the right of About this demo, for Games, Healthcare, Fintech, and E-commerce, plus Uploaded CSV. Views: Backlog, Review, Archived, navigated from a secondary section in the sticky action bar. The sticky action buttons, in order, are Run triage, ClickUp Import, CSV Import, CSV Template, Reload Demo. The stat cards show only on Backlog. Export Backlog CSV lives in the Backlog section, next to the KPI filter. Export Archived CSV lives in the Archived section. Review has Search, Theme, Target KPI, and Source filters over the top 25 drafted items, with Theme and Source options drawn from the scored items in the current pack and KPI options from the pack's fixed list. The Backlog reorders by RICE after triage, with new unscored items at the top.
- Loads `data/*.json` directly. Upload your own CSV with the same columns.
- Client-side triage in the demo: cluster by theme and keywords, score RICE from impact, effort, and confidence, assign one primary KPI per item from the pack's fixed KPI list (keyword match first, then theme map, then the first KPI of the list), flag low evidence, draft stories for the top 25.
- Decisions are kept in browser state in the demo. In the real version they are saved to Supabase via the back end.

## Back end

- `netlify/functions/triage.mjs`: receives items, calls OpenRouter, validates the JSON output, logs token usage, and returns structured scores. Runs on Netlify Free: $0, 300 credits a month, enough for a demo.
- `netlify/functions/clickup.mjs`: receives an approved item, calls the ClickUp API, and returns the ClickUp task id.
- Alternative host: Railway, from the Lenny Product Pass, for the same functions if you prefer a long-running server.
- Keys live only in back end environment variables: `OPENROUTER_API_KEY`, `CLICKUP_API_TOKEN`, `CLICKUP_LIST_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Never put a key in the browser, in chat, or in the repo.

## AI layer

- Primary model: Claude via OpenRouter, one API for many models. See `docs/setup-checklist.md`.
- Backup model: Gemini via Google AI Pro, $10 a month in Gemini API credits, with a $5 prepay to claim them.
- Model routing: a cheaper model for bulk triage of all 200 items per pack, a stronger model only for the top 25 drafts and low-confidence second looks.
- Embeddings: a separate embeddings model for duplicate finding and for RAG retrieval of past decisions.
- Prompts: see `prompts/scoring.md`, `prompts/drafting.md`, and `prompts/clustering.md`. Prompts are stored in the repo and versioned, so a prompt change is a code change with an eval run. The scoring prompt also assigns one primary KPI per item from the pack's fixed KPI list, with a reason and a KPI confidence, and must never invent a KPI name outside the list.
- Structured output: the model must return strict JSON. The back end validates it, retries once on a bad response, and falls back to human review if it still fails.

## RAG

Past approved and rejected items are embedded and stored in Supabase with pgvector. For each new item, the back end pulls the 3 to 5 closest past items and includes them in the scoring prompt. That keeps scoring consistent over time, and it is what stops the same idea being scored differently on different days.

## Database

See `supabase/schema.sql`. Tables: packs, items, clusters, scores, decisions, eval_runs, usage_logs, decision_embeddings. Decisions are immutable: an edit creates a new decision row with a reason, it does not overwrite the old one.

## Evals

Each pack has a 50-item ground truth set in `evals/*.json`. Targets: Healthcare 92%, Fintech 90%, Games 88%, E-commerce 94%. Run the same set on every prompt or model change. A version ships only if accuracy stays at or above its target and the wrong-theme rate does not rise. Results are stored in `eval_runs`.

## Guardrails

- PII redaction before any text reaches a model.
- Confidence cutoff: low-confidence items go to human review only, never auto-accept.
- JSON validation, score range checks, and theme checks before anything is shown.
- Human approval for high-risk items, especially compliance, fraud, safety, and payments.
- Audit trail for every approve, edit, and reject, with reviewer, time, and reason.
- Healthcare note: treat backlog text as if it could contain patient info. Redact it, do not send PHI to a model without a BAA, and keep demo data synthetic.

## Cost tracking

The model API returns input and output tokens per call. Multiply by the model price and log it in `usage_logs` per run, per item, and per pack. The demo estimate is $0.0192 per item, or $3.84 per 200-item run at Claude-like pricing. Real cost replaces that estimate once the back end is live.

## ClickUp

When an item is approved, the back end can create a ClickUp task. See `docs/clickup-integration.md`. One list per industry pack, field mapping for RICE, theme, source, and confidence, and a queue so bulk approvals do not hit the ClickUp rate limit of 100 requests per minute.
