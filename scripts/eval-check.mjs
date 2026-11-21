import fs from 'node:fs';
const targets = { healthcare: 92, fintech: 90, games: 88, ecommerce: 94 };
for (const p of Object.keys(targets)) {
  const evals = JSON.parse(fs.readFileSync(new URL('../evals/' + p + '.json', import.meta.url), 'utf8'));
  const themes = new Set(JSON.parse(fs.readFileSync(new URL('../data/' + p + '.json', import.meta.url), 'utf8')).map(function (d) { return d.theme; }));
  const bad = evals.filter(function (e) { return !themes.has(e.ground_truth_theme) || !['High', 'Medium', 'Low'].includes(e.expected_score_band); });
  // No exact duplicate rows: the same title, theme, and band twice is
  // a wasted eval slot, not a rephrased repeat. Rephrased repeats have
  // a different title (a "Follow up:", "Request:", or "Related:"
  // variant) and are allowed.
  const seen = new Set();
  const dups = evals.filter(function (e) {
    const k = e.title + '|' + e.ground_truth_theme + '|' + e.expected_score_band;
    if (seen.has(k)) return true;
    seen.add(k);
    return false;
  });
  // Every pack must cover the Low band: without it the eval never
  // checks that genuinely low-scoring items score low.
  const hasLow = evals.some(function (e) { return e.expected_score_band === 'Low'; });
  const distinct = new Set(evals.map(function (e) { return e.title; })).size;
  console.log(p, 'evals:', evals.length, 'distinct titles:', distinct, 'target accuracy:', targets[p] + '%', 'bad rows:', bad.length, 'duplicates:', dups.length, 'has Low band:', hasLow);
  if (evals.length !== 50 || bad.length || dups.length || !hasLow) process.exitCode = 1;
}
console.log('Eval check done. Live model eval: run the same 50 items through netlify/functions/triage.mjs and compare returned themes to ground_truth_theme.');
