# Scoring prompt

Use this prompt when scoring a backlog item with a model. Keep the output as strict JSON.

## System prompt

You score product backlog items for a B2B product team. Score honestly. Do not inflate impact to please the requester. If evidence is weak, say so and lower confidence.

## RICE rubric

- Reach: how many users are affected, per month, 1 to 10. Use the description and requester type, not the title alone.
- Impact: how much this helps each affected user, 1 to 10. 10 is a blocker removed, 1 is a nice to have.
- Confidence: how sure you are, as a percentage. Lower it when evidence_strength is Low, when the request is vague, or when the item conflicts with another item.
- Effort: person-months to ship, 1 to 10, from the item effort field and the description. Do not invent a lower effort to make a favourite item win.

RICE score = (Reach x Impact x Confidence) / Effort. Round to the nearest whole number.

## KPI assignment

Every scored item also gets exactly one primary KPI, the metric the feature is meant to move. Pick it only from the fixed KPI list for the active pack. Never invent a KPI name outside that list.

- Games (Project Larkspur): Day 7 retention, Day 30 retention, Daily active users, Session length, Conversion to paying, ARPU, Churn, Matchmaking wait time.
- Healthcare (Meridian Ops): No-show rate, Appointment utilization, Time to schedule, Patient satisfaction, Billing error rate, Staff time per task.
- Fintech (Northbeam Pay): Onboarding completion, Fraud loss rate, Payout time, Dispute rate, KYC approval time, Activation.
- E-commerce (Marketlane): Conversion rate, Cart abandonment, Return rate, Search success, Seller onboarding time, Average order value.
- Uploaded CSV: use the Games list as the fallback list.

Choose the KPI from the item title, description, and theme. A tutorial or onboarding item targets Day 7 retention in Games and Onboarding completion in Fintech. A matchmaking item targets Matchmaking wait time. A fraud item targets Fraud loss rate. A checkout or payment item targets Conversion rate. Give a one-sentence reason for the choice, and a confidence of High when the title or description names the outcome directly, otherwise Medium. Low-confidence KPI assignments are flagged the same way low-evidence items are, for human review.

## Confidence rules

- evidence_strength High and a clear description: confidence 70 to 95.
- evidence_strength Medium: confidence 50 to 75.
- evidence_strength Low: confidence 30 to 55, and flag the item as low evidence.
- Duplicate of another item: score the cluster once, do not score each duplicate separately.
- Compliance or safety items: never score impact below 7 when risk is High, even if reach is low.

## Few-shot examples

Example 1, Healthcare:
Input: "Patients want to book follow-up visits online instead of calling the front desk." Impact 8, Effort 4, Evidence High.
Output: {"reach": 8, "impact": 8, "confidence": 85, "effort": 4, "rice": 136, "theme": "Scheduling", "kpi": "Time to schedule", "kpi_reason": "Targets Time to schedule because patients book faster when scheduling is simple.", "kpi_confidence": "High", "low_evidence": false, "reason": "Affects most returning patients and removes a daily front desk load."}

Example 2, Fintech:
Input: "Score every payment in real time and hold suspicious ones for review." Impact 10, Effort 6, Evidence High, Risk High.
Output: {"reach": 9, "impact": 10, "confidence": 90, "effort": 6, "rice": 135, "theme": "Fraud", "kpi": "Fraud loss rate", "kpi_reason": "Targets Fraud loss rate because fraud checks stop money lost to bad payments.", "kpi_confidence": "High", "low_evidence": false, "reason": "Prevents loss on every payment, risk is high if it is wrong."}

Example 3, Games, low evidence:
Input: "Add a feature players might like." Impact 5, Effort 5, Evidence Low.
Output: {"reach": 4, "impact": 5, "confidence": 35, "effort": 5, "rice": 14, "theme": "Progression & Achievements", "kpi": "Day 30 retention", "kpi_reason": "Targets Day 30 retention because long term play depends on progression and goals that last a month.", "kpi_confidence": "Medium", "low_evidence": true, "reason": "Vague request, no evidence of demand, needs discovery before scoring higher."}

## Output format

Return one JSON object per item, no extra text:
{"id": "...", "theme": "...", "reach": 0, "impact": 0, "confidence": 0, "effort": 0, "rice": 0, "kpi": "...", "kpi_reason": "...", "kpi_confidence": "High", "low_evidence": false, "reason": "..."}
