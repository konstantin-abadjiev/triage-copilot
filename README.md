# Triage

Triage is a working AI product management copilot, not a chatbot demo. It takes a messy, duplicate-filled backlog, clusters it, scores it with RICE and confidence, flags weak evidence, drafts stories for the top items, and leaves the final call to a human. Every industry pack includes evals and a decision log, so you can see not just what it shipped, but how it decided, and why.

This is a showcase of AI-native product work: discovery, prioritization, tradeoffs, evals, guardrails, and human-in-the-loop decisions, across Healthcare, Fintech, Games, and E-commerce.

Live demo: the Triage web artifact (see the repo About section once deployed).
Repo: https://github.com/konstantin-abadjiev/triage-copilot

## What it does

1. Load a backlog: pick an industry pack, or upload your own CSV.
2. Run triage: cluster duplicates and near duplicates, group into themes, score each item with RICE plus a confidence score, flag low-evidence items, and draft a user story plus acceptance criteria for the top 25.
3. Review: approve, edit, or reject each triaged item. Every decision is recorded in a visible audit trail, with a reason. Approved and rejected items move to the Archived tab and leave the active inbox, so the next triage run covers only what is still undecided plus anything new. New items arrive by CSV upload or by Sync from ClickUp, from a separate intake list, and are appended, never replacing the inbox. Re-importing the same items adds nothing. Once Triage takes an item from the intake list, its ClickUp task is closed in ClickUp (status "complete"), never deleted.
4. Roadmap: see the prioritized list in RICE order, filter by theme, and export it as CSV.
5. Evals: see the 50-item ground truth test set for the active pack, with ground truth theme and expected score band per item, plus the release accuracy target for that pack.
6. Decision log: read the audit trail for every approve, edit, and reject, with reviewer, time, reason, and ClickUp task link when there is one.

## Industry packs

| Pack | Company | Domain | Items | Eval accuracy target |
| --- | --- | --- | --- | --- |
| Healthcare | Meridian Ops | Multi-site healthcare clinics: scheduling, intake, billing, compliance, integrations | 200 | 92% |
| Fintech | Northbeam Pay | Small-business payments and lending: fraud, KYC, payouts, disputes, compliance, onboarding | 200 | 90% |
| Games | Project Larkspur | Generic, widely known game features: onboarding, matchmaking and ranked, progression and achievements, social and clans, live events, monetization and battle pass, platform and saves, safety and accessibility | 200 | 88% |
| E-commerce | Marketlane | Marketplace: checkout, inventory, returns, seller tools, search, payments | 200 | 94% |

All data is synthetic. No real company names, no real customer data, and no proprietary data from any employer.

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

1. Pick a pack in the industry switcher.
2. Click Run triage.
3. Open Review Queue. Approve, edit (with a reason), or reject each item.
4. Open Roadmap to see the ranked list and export it.
5. Open Evals to see the pack test set results.

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
- Cost: about $3.84 per 200-item run at Claude-like pricing, or $0.0192 per item. Track real token usage in `usage_logs`.

## Built Together

Triage is built by two collaborators to showcase how we use AI. One owns the product side: prompts, scoring rubric, eval sets, datasets, and the case study. The other owns the accounts and deployment: OpenRouter, Supabase, and Railway, with keys only in back end environment variables, never in chat or in the repo. We build with AI coding tools (Cursor, Amp, Factory, v0, Lovable, Replit), and a human reviews every model output before it ships.

## Repo layout

```
index.html                  Static front end, industry switcher, triage, review, roadmap, evals
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
