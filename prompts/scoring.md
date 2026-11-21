# Scoring prompt

Use this prompt when scoring a backlog item with a model. Keep the output as strict JSON.

Triage has two modes, and the rubric differs between them. Demo mode scores
in the browser with fixed rules and no model call. Live mode sends the items
to the model through `netlify/functions/triage.mjs`, which embeds this same
rubric in its system prompt. If the rubric changes, change both, and keep
the worked examples matching the formula.

## The formula, both modes

RICE = Reach x Impact x Confidence / Effort / 10, rounded to the nearest
whole number, with Confidence as a percentage (0 to 100).

The divide by 10 keeps scores on a readable scale: the maximum is 850
(Reach 10, Impact 10, Confidence 85, Effort 1 is 850; Confidence 100
would be 1000, but no item scores 100). Simulated per-pack maxima with
the Demo Reach table are Games 268, Healthcare 344, Fintech 408,
E-commerce 536.

## Reach scale, both modes

Reach is how many users the item affects, 1 to 10.

- 1: a handful of users, or one team.
- 3: one user group, or an occasional workflow.
- 5: about half the users, or a weekly workflow.
- 7: most users, or a daily workflow.
- 9: nearly every user, or the core flow.
- 10: every user, every week.

## Demo mode: Reach from theme

Demo never estimates Reach per item. It reads Reach off the theme, so
the demo math is honest instead of hiding Reach inside Impact squared
(the old Demo formula was Impact x Impact, which used Impact as a Reach
proxy). The card labels Demo Reach as estimated, because no per-item
evidence backs it. Unknown themes default to 5.

Games (Grekon Games):

| Theme | Reach |
| --- | --- |
| Onboarding & Tutorials | 9 |
| Matchmaking & Ranked | 8 |
| Platform/Saves & Performance | 8 |
| Live Events & Seasonal Content | 7 |
| Progression & Achievements | 7 |
| Social/Friends & Clans | 7 |
| Monetization & Battle Pass | 6 |
| Safety/Accessibility & Controls | 5 |

Healthcare (Grekon Health):

| Theme | Reach |
| --- | --- |
| Scheduling | 9 |
| Intake | 8 |
| Communications | 8 |
| Billing | 7 |
| Integrations | 6 |
| Staff Workflows | 6 |
| Compliance | 5 |
| Reporting | 4 |

Fintech (Grekon Financial):

| Theme | Reach |
| --- | --- |
| Onboarding | 9 |
| Payouts | 8 |
| Fraud | 7 |
| KYC | 7 |
| Disputes | 5 |
| Compliance | 5 |
| Reporting | 4 |

E-commerce (Grekon Market):

| Theme | Reach |
| --- | --- |
| Checkout | 9 |
| Search | 8 |
| Payments | 8 |
| Returns | 6 |
| Inventory | 5 |
| Seller Tools | 5 |

Demo confidence is fixed by evidence_strength, not estimated: High is
85, Medium is 65, Low is 40. Impact and Effort come straight from the
item. The Demo story and acceptance criteria are templates, not model
output.

Demo worked example, Healthcare: a Scheduling item, Impact 8, Effort 4,
Evidence High. Reach is 9 from the table, Confidence is 85. RICE is
9 x 8 x 85 / 4 / 10 = 153.

## Live mode: the model estimates Reach

In Live mode the model estimates Reach per item, 1 to 10, from the
title, description, and theme: who is affected and how often. It does
not use the theme table.

- When the item text names the affected users clearly, Reach confidence
  is High.
- When the text hints at who is affected but does not name them, Reach
  confidence is Medium.
- When the item text does not say who is affected at all, the model
  gives its best Reach estimate and sets `reach_confidence` to Low.
  A low-confidence Reach estimate is flagged on the card the same way a
  low-evidence item is flagged, for human review before build.

Live confidence follows the ranges below, not the Demo fixed values.
Evidence_strength High and a clear description: confidence 70 to 95.
Evidence_strength Medium: confidence 50 to 75. Evidence_strength Low:
confidence 30 to 55, and flag the item as low evidence.

Other Live rules, same as the system prompt:

- Impact: how much this helps each affected user, 1 to 10. 10 is a
  blocker removed, 1 is a nice to have.
- Effort: person-months to ship, 1 to 10, from the item effort field
  and the description. Do not invent a lower effort to make a favourite
  item win.
- Duplicate of another item: score the cluster once, do not score each
  duplicate separately.
- Compliance or safety items: never score impact below 7 when risk is
  High, even if reach is low.

## System prompt

You score product backlog items for a B2B product team. Score honestly. Do not inflate impact to please the requester. If evidence is weak, say so and lower confidence.

## RICE rubric

- Reach: how many users are affected, 1 to 10, per the Reach scale
  above. In Live mode, estimate it per item from the description and
  requester type, not the title alone, and set `reach_confidence`
  High, Medium, or Low for how sure the estimate is.
- Impact: how much this helps each affected user, 1 to 10. 10 is a blocker removed, 1 is a nice to have.
- Confidence: how sure you are, as a percentage. Lower it when evidence_strength is Low, when the request is vague, or when the item conflicts with another item.
- Effort: person-months to ship, 1 to 10, from the item effort field and the description. Do not invent a lower effort to make a favourite item win.

RICE score = Reach x Impact x Confidence / Effort / 10. Round to the nearest whole number.

## KPI assignment

Every scored item also gets exactly one primary KPI, the metric the feature is meant to move. Pick it only from the fixed KPI list for the active pack. Never invent a KPI name outside that list.

- Games (Grekon Games): Day 7 retention, Day 30 retention, Daily active users, Session length, Conversion to paying, ARPU, Churn, Matchmaking wait time.
- Healthcare (Grekon Health): No-show rate, Appointment utilization, Time to schedule, Patient satisfaction, Billing error rate, Staff time per task.
- Fintech (Grekon Financial): Onboarding completion, Fraud loss rate, Payout time, Dispute rate, KYC approval time, Activation.
- E-commerce (Grekon Market): Conversion rate, Cart abandonment, Return rate, Search success, Seller onboarding time, Average order value.
- CSV-imported items use the current pack's fixed KPI list, like any other item in that pack.

Choose the KPI from the item title, description, and theme. A tutorial or onboarding item targets Day 7 retention in Games and Onboarding completion in Fintech. A matchmaking item targets Matchmaking wait time. A fraud item targets Fraud loss rate. A checkout or payment item targets Conversion rate. Give a one-sentence reason for the choice. One confidence everywhere: kpi_confidence is derived from the confidence number (75 or above High, 55 to 74 Medium, below 55 Low), never a separate judgement that could contradict it. Low-confidence KPI assignments are flagged the same way low-evidence items are, for human review.

## Confidence rules

- evidence_strength High and a clear description: confidence 70 to 95.
- evidence_strength Medium: confidence 50 to 75.
- evidence_strength Low: confidence 30 to 55, and flag the item as low evidence.
- Duplicate of another item: score the cluster once, do not score each duplicate separately.
- One confidence everywhere: kpi_confidence always agrees with the confidence number (75 or above High, 55 to 74 Medium, below 55 Low).
- Compliance or safety items: never score impact below 7 when risk is High, even if reach is low.

## Few-shot examples

Example 1, Healthcare:
Input: "Patients want to book follow-up visits online instead of calling the front desk." Impact 8, Effort 4, Evidence High.
Output: {"id": "...", "theme": "Scheduling", "reach": 8, "impact": 8, "confidence": 85, "effort": 4, "rice": 136, "kpi": "Time to schedule", "kpi_reason": "Targets Time to schedule because patients book faster when scheduling is simple.", "kpi_confidence": "High", "low_evidence": false, "reach_confidence": "High", "story": "As a clinic manager, I want patients to book follow-up visits online so that front desk calls drop.", "acceptance": ["Given a patient booking a follow-up, when they open the portal, then they can pick a follow-up slot.", "Given a booked follow-up, when the visit is confirmed, then the front desk sees it without a phone call."], "reason": "Affects most returning patients and removes a daily front desk load."}
Check: 8 x 8 x 85 / 4 / 10 = 136.

Example 2, Fintech:
Input: "Score every payment in real time and hold suspicious ones for review." Impact 10, Effort 6, Evidence High, Risk High.
Output: {"id": "...", "theme": "Fraud", "reach": 9, "impact": 10, "confidence": 90, "effort": 6, "rice": 135, "kpi": "Fraud loss rate", "kpi_reason": "Targets Fraud loss rate because fraud checks stop money lost to bad payments.", "kpi_confidence": "High", "low_evidence": false, "reach_confidence": "High", "story": "As a risk analyst, I want suspicious payments held for review so that fraud losses drop.", "acceptance": ["Given a suspicious payment, when it is scored, then it is held for manual review.", "Given a held payment, when a reviewer clears it, then it settles."], "reason": "Prevents loss on every payment, risk is high if it is wrong."}
Check: 9 x 10 x 90 / 6 / 10 = 135.

Example 3, Games, low evidence:
Input: "Add a feature players might like." Impact 5, Effort 5, Evidence Low.
Output: {"id": "...", "theme": "Progression & Achievements", "reach": 4, "impact": 5, "confidence": 35, "effort": 5, "rice": 14, "kpi": "Day 30 retention", "kpi_reason": "Targets Day 30 retention because long term play depends on progression and goals that last a month.", "kpi_confidence": "Low", "low_evidence": true, "reach_confidence": "Low", "story": "As a player, I want a feature worth coming back for so that I keep playing.", "acceptance": ["Given a player opening the game, when they see the feature, then it is clear what it does.", "Given a low-evidence item, when it reaches review, then discovery is complete before build starts."], "reason": "Vague request, no evidence of demand, needs discovery before scoring higher."}
Check: 4 x 5 x 35 / 5 / 10 = 14.

## Output format

Return one JSON object per item, no extra text:
{"id": "...", "theme": "...", "reach": 0, "impact": 0, "confidence": 0, "effort": 0, "rice": 0, "kpi": "...", "kpi_reason": "...", "kpi_confidence": "High", "low_evidence": false, "reach_confidence": "High", "story": "...", "acceptance": ["...", "..."]}
