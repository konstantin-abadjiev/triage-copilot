import fs from 'node:fs';
const packs = ['healthcare', 'fintech', 'games', 'ecommerce'];
let ok = true;
for (const p of packs) {
  const data = JSON.parse(fs.readFileSync(new URL('../data/' + p + '.json', import.meta.url), 'utf8'));
  const csv = fs.readFileSync(new URL('../data/' + p + '.csv', import.meta.url), 'utf8').trim().split('\n');
  const evals = JSON.parse(fs.readFileSync(new URL('../evals/' + p + '.json', import.meta.url), 'utf8'));
  console.log(p, 'json:', data.length, 'csv rows:', csv.length - 1, 'evals:', evals.length);
  if (data.length !== 200) { console.error(p, 'expected 200 json items'); ok = false; }
  if (csv.length - 1 !== 200) { console.error(p, 'expected 200 csv rows'); ok = false; }
  if (evals.length !== 50) { console.error(p, 'expected 50 eval items'); ok = false; }
  const themes = new Set(data.map(function (d) { return d.theme; }));
  for (const e of evals) if (!themes.has(e.ground_truth_theme)) { console.error(p, 'eval theme not in pack:', e.ground_truth_theme); ok = false; }
}
process.exit(ok ? 0 : 1);
