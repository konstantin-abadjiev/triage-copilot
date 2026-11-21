import fs from 'node:fs';
const targets = { healthcare: 92, fintech: 90, games: 88, ecommerce: 94 };
for (const p of Object.keys(targets)) {
  const evals = JSON.parse(fs.readFileSync(new URL('../evals/' + p + '.json', import.meta.url), 'utf8'));
  const themes = new Set(JSON.parse(fs.readFileSync(new URL('../data/' + p + '.json', import.meta.url), 'utf8')).map(function (d) { return d.theme; }));
  const bad = evals.filter(function (e) { return !themes.has(e.ground_truth_theme) || !['High', 'Medium', 'Low'].includes(e.expected_score_band); });
  console.log(p, 'evals:', evals.length, 'target accuracy:', targets[p] + '%', 'bad rows:', bad.length);
  if (evals.length !== 50 || bad.length) process.exitCode = 1;
}
console.log('Eval check done. Live model eval: run the same 50 items through netlify/functions/triage.mjs and compare returned themes to ground_truth_theme.');
