# Evals

Each pack has a 50-item ground truth test set with 50 distinct titles per pack: Healthcare 50, Fintech 50, Games 50, E-commerce 50. Some titles are rephrased variants of a data item (a "Follow up:", "Request:", or "Related:" form), which test that the model scores the same request the same way twice, but no title appears twice. Exact duplicate rows (same title, theme, and band) are not allowed; `scripts/eval-check.mjs` fails on them.

Fields per item:
- `id`: eval item id, for example `EVAL-HEA-01`
- `title`: the item title as a user would write it
- `ground_truth_theme`: the correct theme from the pack taxonomy
- `expected_score_band`: High, Medium, or Low, from impact and effort

## Score bands

A band comes from the median impact and effort of the data items with that title: High when median impact is 8 or more and median effort is 4 or less; Low when median impact is 6 or less and median effort is 5 or more; otherwise Medium. Low-band rows are drawn from genuinely low-scoring data items (low impact, high effort, or Low evidence), so the eval checks that weak items score low instead of only checking that strong items score high. Every pack covers all three bands.

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

`scripts/eval-check.mjs` verifies each eval file has 50 items, every ground truth theme exists in its pack taxonomy, every score band is High, Medium, or Low, no two rows are exact duplicates, and every pack has at least one Low-band row. It does not call a model. For a live model eval, run the same 50 items through `netlify/functions/triage.mjs` and compare the returned themes to `ground_truth_theme`.

## Release rule

A prompt or model change ships only if accuracy on all four packs stays at or above its target, and the wrong-theme rate does not rise. Low-confidence items must go to human review, never auto-accept.
