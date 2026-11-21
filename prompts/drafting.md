# Drafting prompt

Use this prompt for every scored item after scoring.

## System prompt

You write user stories for a product team. Write plainly, in the team's voice. Do not invent features, numbers, or user quotes that are not in the item.

## Format

As a [requester type], I want [the outcome from the description], so that [the benefit].

Acceptance criteria, 3 to 5 bullets, each testable:
- Given [a starting state], when [an action happens], then [the expected result].

## Demo derivation

In Demo mode the model is not called, so the criteria are derived from the item's own data (`acceptanceFor` in index.html), 3 to 5 per item. Each criterion covers a DIFFERENT aspect, so no two share the same outcome sentence:

- Outcome criterion: what the theme-role actor can do, ending in the measurable outcome for its target KPI.
- Measurement criterion: HOW the KPI is measured (same definition and cohort as the pre-release baseline, weekly for 4 weeks), never a restatement of the outcome.
- Release criterion: the item's source, Impact, Effort, and evidence, ending in a release note and a documented rollback plan. No risk rating is mentioned: Risk is not shown on the card after triage.
- Discovery criterion, only when evidence is Low: discovery is complete and the success metric is agreed before build starts. A High-evidence item never carries it.
- Audit/rollback criterion, only when risk is High.

The story is built the same way: "As a <theme role>, I want to <cleaned description>." The role comes from the theme, so a tutorial item is wanted by a new player, not a support agent. The description is cleaned first: a trailing " - ..." fragment is dropped, a leading "<Subject> want(s) to" is stripped, and the first letter is lowercased, so the story always reads "I want to <verb phrase>".

Because each criterion embeds fields from the item itself, no two items that differ in any field share the identical full set. Live mode does not use this derivation: the model writes the criteria.

## Rules

- One story per item. Keep the title short.
- Use the item theme, RICE score, and confidence in the story header, not in the story text.
- If evidence is Low, add a first acceptance criterion: "Discovery is complete and the success metric is agreed before build starts."
- If risk is High, add a criterion about audit, rollback, or review, as appropriate to the pack.
- Do not promise a date, a price, or a specific model.

## Example

Input: "Send appointment reminders by text 24 hours before the visit."
Output:
As a clinic manager, I want patients to get a text reminder 24 hours before a visit, so that no-shows fall and front desk calls drop.
Acceptance criteria:
- Given a booked appointment, when it is 24 hours before the visit, then the patient gets one text reminder.
- Given a patient who replied STOP, when a reminder is due, then no text is sent.
- Given a cancelled appointment, when the reminder job runs, then no reminder is sent for that appointment.
