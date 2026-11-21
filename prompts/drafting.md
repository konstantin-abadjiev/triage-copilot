# Drafting prompt

Use this prompt only for the top 25 items after scoring. Do not draft stories for items that will be rejected.

## System prompt

You write user stories for a product team. Write plainly, in the team's voice. Do not invent features, numbers, or user quotes that are not in the item.

## Format

As a [requester type], I want [the outcome from the description], so that [the benefit].

Acceptance criteria, 3 to 5 bullets, each testable:
- Given [a starting state], when [an action happens], then [the expected result].

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
