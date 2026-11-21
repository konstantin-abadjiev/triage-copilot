# Triage

Triage is a working AI product management copilot, not a chatbot demo. It takes a messy, duplicate-filled backlog, clusters it, scores it with RICE and confidence, flags weak evidence, drafts a story for every scored item, and leaves the final call to a human. Every item is scored in the open, with its story written out, so you can see not just what it shipped, but how it decided, and why.

This is a showcase of AI-native product work: discovery, prioritization, tradeoffs, guardrails, and human-in-the-loop decisions, across Healthcare, Fintech, Games, and E-commerce.

Live demo: the Triage web artifact (see the repo About section once deployed).
Repo: https://github.com/konstantin-abadjiev/triage-copilot

## What it does

1. Load a backlog: pick an industry pack, or upload your own CSV.
The stat cards (Backlog Items, Duplicate Clusters, Low-Evidence Flags, Decisions Logged, Est. Cost / Run) show only on Backlog, not on Archived.
2. Run triage: cluster duplicates and near duplicates, group into themes, score each item with RICE plus a confidence score, assign exactly one primary KPI from the fixed list for the active pack (with a one-sentence reason and a KPI confidence), flag low-evidence items, and draft a user story plus acceptance criteria for every scored item.
3. Backlog: after triage, new unscored items sit at the top, then every scored item in RICE order, highest first. Each scored card shows its story, acceptance criteria, KPI with reason and confidence, and Approve / Edit / Reject buttons. Editing a story is not a decision: the item stays in the Backlog until it is approved or rejected. Every decision is recorded with a typed reason and reviewer. Search, Theme, Target KPI, and Source filters apply to the whole Backlog. Approved and rejected items move to Archived and leave the active inbox, so the next triage run covers only what is still undecided plus anything new. Approved items export to ClickUp in the Triage Approved list, and the Backlog and Archived descriptions link to that list. New items arrive by CSV upload or by Sync from ClickUp, from a separate intake list, and are appended, never replacing the inbox. Re-importing the same items adds nothing. Once Triage takes an item from the intake list, its ClickUp task is closed in ClickUp (status "complete"), never deleted. Backlog and Archived both show 10 items per page.
4. Delete removes an item completely, and you can export the Backlog as CSV with a KPI column.
5. Archived: approved and rejected items leave the active inbox, with their decision, reason, reviewer, time, KPI, and ClickUp task link when there is one. Export them with Export Archived CSV in the Archived section. A failed Approve stays pending in the inbox with its Approve, Edit, and Reject buttons still enabled and a retry button; no decision is recorded until the ClickUp task is created.

State is session-only: reloading the page wipes decisions, scores, the archive, edits, uploads, and deletes. Export anything you want to keep.

## Industry packs

| Pack | Company | Domain | Items | Eval accuracy target |
| --- | --- | --- | --- | --- |
| Healthcare | Grekon Health | Multi-site healthcare clinics: scheduling, intake, billing, compliance, integrations | 200 | 92% |
| Fintech | Grekon Financial | Small-business payments and lending: fraud, KYC, payouts, disputes, compliance, onboarding | 200 | 90% |
| Games | Grekon Games | Generic, widely known game features: onboarding, matchmaking and ranked, progression and achievements, social and clans, live events, monetization and battle pass, platform and saves, safety and accessibility | 200 | 88% |
| E-commerce | Grekon Market | Marketplace: checkout, inventory, returns, seller tools, search, payments | 200 | 94% |

All data is synthetic. No real company names, no real customer data, and no proprietary data from any employer.

## Demo vs Live

One app, one deploy, a mode toggle in the header. Default is Demo.

- Demo mode: rule-based scoring runs in your browser. Reach comes from
  a theme table (see `prompts/scoring.md`) and is labeled estimated on
  each card. Cost is a modeled estimate of $0.0192 per item. Real cost
  is $0, no API key needed.
- Live mode: Run triage POSTs the unscored items to
  `/.netlify/functions/triage`, which calls the model (Claude via
  OpenRouter) and returns per-item Reach, RICE, KPI, story, and
  acceptance criteria, plus the real per-token cost. The front end uses
  the model's values directly and never re-scores them. Every Live run
  asks for confirmation first ("This run will call the model and cost
  real money. Continue?"). If the key is not configured, Live shows
  "Live mode needs OPENROUTER_API_KEY set in Netlify" and scores
  nothing. The rule-based Demo scoring is never returned as a Live
  result.

## Hookup checklist (Live mode)

The collaborator (friend) owns the OpenRouter account and billing, and
the key. The key lives only in Netlify environment variables, never in
chat, email, or the repo, and never in a committed `.env` file.

1. Friend creates an OpenRouter account at openrouter.ai and adds
   billing (pay as you go; a 200-item run is a few dollars at most at
   Claude Sonnet pricing, and the app shows the real cost after each
   run).
2. Friend creates an API key in OpenRouter and hands it over privately
   (not in chat).
3. In Netlify, open the Triage site, then Site settings, then
   Environment variables, and add `OPENROUTER_API_KEY` with the key.
4. Redeploy the site so the new variable reaches the function.
5. Open the app, switch the header toggle to Live, and click Run
   triage. Confirm the cost prompt. The first Live run scores the
   unscored items in the current pack and shows the real cost in the
   Cost / Run card.
6. If Live reports "Live mode needs OPENROUTER_API_KEY set in Netlify",
   the variable did not reach the function: check the name and
   redeploy.

Supabase persistence (saving items, scores, and decisions to a
database) is a separate later step and is NOT part of this setup. State
is still session-only: reloading the page wipes it.

## Site-origin check (function gate)

All four Netlify functions (`clickup.mjs`, `clickup-intake.mjs`,
`clickup-intake-close.mjs`, `triage.mjs`) accept only requests from
the deployed site: the Origin header (falling back to Referer when
Origin is absent) must be `https://triage-copilot.netlify.app`, a
deploy preview (`https://<anything>--triage-copilot.netlify.app`), or
`http://localhost` / `http://127.0.0.1` for local development. Anything
else — a wrong origin, or no origin and no referer at all — returns
HTTP 403 with `{ok:false, error:"Forbidden"}` and the function does
nothing: no ClickUp call, no OpenRouter call, no task close. The front
end sends no secret at all; the browser sends its Origin header
automatically.

Deploy the site with the plain build script, no secret involved:

```
./scripts/build-deploy-zip.sh
```

The script copies the starter to a throwaway directory and zips it.
The starter itself is never modified.

Honest limitation: Origin and Referer headers can be spoofed by a
determined caller, so this gate stops casual scans and random bots
from spending OpenRouter money or writing to ClickUp. It is not real
authentication; a login is future work. The earlier shared-secret
gate was removed because it baked the secret into index.html at
deploy time, and Netlify's secrets scan rightly failed that deploy.
The `TRIAGE_SHARED_SECRET` environment variable is now unused and
can be deleted from Netlify Site settings > Environment variables.

## How to run locally

```bash
npm install
npm run dev
```

Then open http://localhost:8080 (or the port shown). The static front end in `index.html` loads `data/*.json` directly, so it also works by serving the folder with any static server:

```bash
npx serve .
```

No API key is needed for the demo. Triage logic in the browser is rule based and deterministic, so eval numbers are reproducible.

## How to run triage

1. Pick a pack in the Industry pack dropdown in the header, to the right of About this demo.
2. Pick Demo or Live with the Mode toggle in the header (two side-by-side buttons, active one filled). Demo is the default and costs nothing.
3. Click Run triage. The sticky action bar buttons, in order, are Run triage, ClickUp Import, CSV Import, CSV Template, Reload Demo. A Live run asks for confirmation first, because it costs real money.
4. In Backlog, approve (with a reason), edit, or reject any scored item, in RICE order. Each scored card shows its Reach, Impact, Effort, and Confidence; Demo Reach is labeled estimated.
5. Use the Backlog filters to work through items, and export the Backlog with Export Backlog CSV in the Backlog section.
6. Open Archived to see decided items, with their reason and ClickUp task link when there is one, and export them with Export Archived CSV in the Archived section.

To use your own backlog, upload a CSV with these columns: `id, title, description, source, requester_type, theme, impact, effort, risk, evidence_strength`. See `data/healthcare.csv` for the exact format.

## How to run evals

```bash
npm run eval
```

This checks each `evals/*.json` file: 50 items, ground truth themes that exist in the pack taxonomy, and a score band for each item. The published targets are Healthcare 92%, Fintech 90%, Games 88%, E-commerce 94%. See `evals/README.md`.

## Making it real

The demo is static and rule based. The real version adds a back end, a database, and a live model. See `docs/architecture.md` for the full plan, and `docs/setup-checklist.md` for the accounts and keys to claim.

In short:
- Back end: `netlify/functions/triage.mjs` calls OpenRouter (Claude via one API) using `OPENROUTER_API_KEY`. Gemini via Google AI Pro is the backup.
- Database: `supabase/schema.sql` in Supabase Postgres, with pgvector for past decisions.
- ClickUp: `netlify/functions/clickup.mjs` creates a task when an item is approved. See `docs/clickup-integration.md`.
- Cost: about $3.84 per 200-item run at Claude-like pricing, or $0.0192 per item (Demo estimate; a Live run shows its real cost). Track real token usage in `usage_logs`.

## Built Together

Triage is built by two collaborators to showcase how we use AI. One owns the product side: prompts, scoring rubric, eval sets, datasets, and the showcase. The other owns the accounts and deployment: OpenRouter, Supabase, and Railway, with keys only in back end environment variables, never in chat or in the repo. We build with AI coding tools (Cursor, Amp, Factory, v0, Lovable, Replit), and a human reviews every model output before it ships.

## Repo layout

```
index.html                  Static front end, industry switcher, triage, backlog review
data/                       200-item backlogs per pack, CSV and JSON
evals/                      50-item ground truth sets per pack
prompts/                    Scoring, drafting, and clustering prompts
netlify/functions/          triage.mjs, clickup.mjs, clickup-intake.mjs, and clickup-intake-close.mjs back end functions
netlify.toml                Netlify config, static site plus functions
supabase/                   schema.sql and setup notes
docs/                       architecture, setup checklist, ClickUp integration
```

## License

MIT. See LICENSE.
