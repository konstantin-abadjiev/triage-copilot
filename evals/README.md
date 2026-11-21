# Evals

Each pack has a 50-item ground truth test set: 36 unique items plus 14 rephrased repeats.

Fields per item:
- `id`: eval item id, for example `EVAL-HEA-01`
- `title`: the item title as a user would write it
- `ground_truth_theme`: the correct theme from the pack taxonomy
- `expected_score_band`: High, Medium, or Low, from impact and effort

## Published accuracy targets

These are the targets the demo reports, and the thresholds a real model version must meet before shipping:

- Healthcare: 92%
- Fintech: 90%
- Games: 88%
- E-commerce: 94%

## How to run

```bash
npm run eval
```

`scripts/eval-check.mjs` verifies each eval file has 50 items, every ground truth theme exists in its pack taxonomy, and every score band is High, Medium, or Low. It does not call a model. For a live model eval, run the same 50 items through `netlify/functions/triage.mjs` and compare the returned themes to `ground_truth_theme`.

## Release rule

A prompt or model change ships only if accuracy on all four packs stays at or above its target, and the wrong-theme rate does not rise. Low-confidence items must go to human review, never auto-accept.
