// Triage back end, Netlify Function. LIVE mode only.
// Receives unscored items, calls OpenRouter, validates output, logs
// token usage, and returns the model's scores plus the real per-token
// cost. Set OPENROUTER_API_KEY in Netlify environment variables, never
// in code. No real API key is included in this repo.
// Every call is gated by a site-origin check (see
// netlify/functions/lib/auth.mjs): the function accepts only requests
// from triage-copilot.netlify.app, its deploy previews, or localhost.
// Anything else returns 403 and the function does nothing.
//
// The rule-based Demo scoring lives ONLY in the front end
// (index.html, scoreItem). It is never a Live response: when the key is
// missing this function returns {ok:false} and no scores at all, so the
// front end can say plainly that Live is not configured instead of
// showing realistic-looking Demo scores as if the model produced them.
//
// The scoring rubric the model follows is prompts/scoring.md. The
// system prompt below embeds the same rules; if the rubric changes,
// change both, and keep the worked examples matching the formula.
import { authorize } from './lib/auth.mjs';

export async function handler(event) {
  const denied = authorize(event);
  if (denied) return denied;
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'Use POST' }) };
  }
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) };
  }
  const items = Array.isArray(body.items) ? body.items.slice(0, 200) : [];
  const pack = typeof body.pack === 'string' ? body.pack.toLowerCase() : '';
  if (!items.length) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'No items to score. Send {items: [...], pack: "..."}.' }) };
  }
  if (['games', 'healthcare', 'fintech', 'ecommerce'].indexOf(pack) === -1) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'Unknown pack. Use games, healthcare, fintech, or ecommerce.' }) };
  }
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    // No key, no scores. Never fall back to rule-based scores here: a
    // Live run with no key must fail loudly, not look successful.
    return { statusCode: 501, body: JSON.stringify({ ok: false, error: 'Live scoring is not configured. Set OPENROUTER_API_KEY in Netlify environment variables.' }) };
  }
  // Live model path: one structured call per batch of 25 items.
  // Prompt text lives in prompts/scoring.md, versioned in the repo.
  // The model must return strict JSON: one object per item, with
  // {id, theme, reach, impact, confidence, effort, rice, kpi,
  // kpi_reason, kpi_confidence, low_evidence, reach_confidence, story,
  // acceptance}.
  const scores = [];
  let invalid = 0;
  let inputTokens = 0, outputTokens = 0;
  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25);
    let res;
    try {
      res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/konstantin-abadjiev/triage-copilot',
          'X-Title': 'Triage Copilot'
        },
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4',
          messages: [
            { role: 'system', content: systemPrompt(pack) },
            { role: 'user', content: JSON.stringify(batch) }
          ],
          response_format: { type: 'json_object' }
        }),
        signal: AbortSignal.timeout(60000)
      });
    } catch (err) {
      const timedOut = err && err.name === 'AbortError';
      return { statusCode: 502, body: JSON.stringify({ ok: false, error: timedOut ? 'OpenRouter request timed out after 60s' : 'Could not reach OpenRouter', detail: String(err && err.message ? err.message : err).slice(0, 200) }) };
    }
    if (!res.ok) {
      let detail = '';
      try {
        const eb = await res.json();
        if (eb && eb.error && typeof eb.error.message === 'string') detail = eb.error.message;
        else if (eb && typeof eb.message === 'string') detail = eb.message;
      } catch {}
      return { statusCode: 502, body: JSON.stringify({ ok: false, error: 'OpenRouter returned status ' + res.status + (detail ? '. ' + detail.slice(0, 200) : '') }) };
    }
    let data;
    try {
      data = await res.json();
    } catch {
      return { statusCode: 502, body: JSON.stringify({ ok: false, error: 'OpenRouter returned an unreadable response' }) };
    }
    inputTokens += data.usage ? data.usage.prompt_tokens || 0 : 0;
    outputTokens += data.usage ? data.usage.completion_tokens || 0 : 0;
    // Guard malformed model responses: empty choices, no content, bad
    // JSON, or a missing scores array are clean 502s, never a crash and
    // never partial-looking success.
    const choice = data.choices && data.choices[0];
    const content = choice && choice.message && choice.message.content;
    if (!content || typeof content !== 'string') {
      return { statusCode: 502, body: JSON.stringify({ ok: false, error: 'The model returned an empty response' }) };
    }
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { statusCode: 502, body: JSON.stringify({ ok: false, error: 'The model returned invalid JSON' }) };
    }
    const batchScores = Array.isArray(parsed) ? parsed : parsed.scores;
    if (!Array.isArray(batchScores)) {
      return { statusCode: 502, body: JSON.stringify({ ok: false, error: 'The model returned no scores array' }) };
    }
    for (const s of batchScores) {
      if (validateScore(s)) scores.push(normalizeScore(s));
      else invalid++;
    }
  }
  const costUsd = (inputTokens * 0.000003) + (outputTokens * 0.000015);
  return { statusCode: 200, body: JSON.stringify({ ok: true, pack, model: 'anthropic/claude-sonnet-4', scores, invalid, usage: { inputTokens, outputTokens, costUsd } }) };
}

// One score is usable only when it carries the full contract shape.
// Invalid scores are counted, never returned as if they were real.
function validateScore(s) {
  if (!s || typeof s.id !== 'string' || !s.id) return false;
  if (typeof s.reach !== 'number' || !(s.reach >= 1 && s.reach <= 10)) return false;
  if (typeof s.impact !== 'number' || !(s.impact >= 0 && s.impact <= 10)) return false;
  if (typeof s.confidence !== 'number' || !(s.confidence >= 0 && s.confidence <= 100)) return false;
  if (typeof s.effort !== 'number' || !(s.effort > 0 && s.effort <= 10)) return false;
  if (typeof s.rice !== 'number' || !isFinite(s.rice) || s.rice < 0) return false;
  if (typeof s.kpi !== 'string' || !s.kpi) return false;
  if (typeof s.story !== 'string' || !s.story) return false;
  if (s.reach_confidence != null && ['High', 'Medium', 'Low'].indexOf(s.reach_confidence) === -1) return false;
  if (s.kpi_confidence != null && ['High', 'Medium', 'Low'].indexOf(s.kpi_confidence) === -1) return false;
  return true;
}

function normalizeScore(s) {
  return {
    id: s.id,
    theme: typeof s.theme === 'string' ? s.theme : '',
    reach: s.reach,
    impact: s.impact,
    confidence: s.confidence,
    effort: s.effort,
    rice: s.rice,
    kpi: s.kpi,
    kpi_reason: typeof s.kpi_reason === 'string' ? s.kpi_reason : '',
    // One confidence everywhere, same rule as Demo: the KPI
    // confidence label is derived from the confidence number (75+
    // High, 55-74 Medium, below 55 Low), never taken from the model
    // as a separate value that could contradict the number.
    kpi_confidence: (typeof s.confidence === 'number') ? (s.confidence >= 75 ? 'High' : s.confidence >= 55 ? 'Medium' : 'Low') : 'Medium',
    low_evidence: !!s.low_evidence,
    reach_confidence: typeof s.reach_confidence === 'string' ? s.reach_confidence : '',
    story: s.story,
    acceptance: Array.isArray(s.acceptance) ? s.acceptance : []
  };
}

const KPIS = {
  games: ['Day 7 retention', 'Day 30 retention', 'Daily active users', 'Session length', 'Conversion to paying', 'ARPU', 'Churn', 'Matchmaking wait time'],
  healthcare: ['No-show rate', 'Appointment utilization', 'Time to schedule', 'Patient satisfaction', 'Billing error rate', 'Staff time per task'],
  fintech: ['Onboarding completion', 'Fraud loss rate', 'Payout time', 'Dispute rate', 'KYC approval time', 'Activation'],
  ecommerce: ['Conversion rate', 'Cart abandonment', 'Return rate', 'Search success', 'Seller onboarding time', 'Average order value']
};

const THEMES = {
  games: ['Onboarding & Tutorials', 'Live Events & Seasonal Content', 'Matchmaking & Ranked', 'Monetization & Battle Pass', 'Platform/Saves & Performance', 'Progression & Achievements', 'Safety/Accessibility & Controls', 'Social/Friends & Clans'],
  healthcare: ['Scheduling', 'Intake', 'Billing', 'Communications', 'Compliance', 'Integrations', 'Reporting', 'Staff Workflows'],
  fintech: ['Onboarding', 'Payouts', 'Fraud', 'KYC', 'Disputes', 'Compliance', 'Reporting'],
  ecommerce: ['Checkout', 'Search', 'Payments', 'Inventory', 'Returns', 'Seller Tools']
};

// The rubric from prompts/scoring.md, embedded so the function carries
// it. Keep the two in sync: same Reach scale, same RICE formula, same
// KPI lists, same output shape.
function systemPrompt(pack) {
  return [
    'You score product backlog items for a B2B product team. Score honestly. Do not inflate impact to please the requester. If evidence is weak, say so and lower confidence.',
    'RICE rubric, per item:',
    '- Reach: how many users the item affects, 1 to 10. 1 is a handful of users or one team, 10 is nearly every user every week. Estimate it from the title, description, and theme: who is affected and how often. When the item text does not say who is affected, give your best estimate and set reach_confidence to Low. When the text names the affected users clearly, reach_confidence is High, otherwise Medium.',
    '- Impact: how much this helps each affected user, 1 to 10. 10 is a blocker removed, 1 is a nice to have.',
    '- Confidence: how sure you are, as a percentage 0 to 100. evidence_strength High and a clear description: 70 to 95. Medium: 50 to 75. Low: 30 to 55, and set low_evidence to true. Lower it when the request is vague or conflicts with another item.',
    '- Effort: person-months to ship, 1 to 10, from the item effort field and the description. Do not invent a lower effort to make a favourite item win.',
    '- RICE = Reach x Impact x Confidence / Effort / 10, rounded to the nearest whole number, with Confidence as a percentage. Example: Reach 9, Impact 8, Confidence 85, Effort 4 gives 9 x 8 x 85 / 4 / 10 = 153.',
    '- KPI: exactly one primary KPI, only from this pack list: ' + KPIS[pack].join(', ') + '. Never invent a KPI name outside the list. Give a one-sentence kpi_reason and a kpi_confidence that agrees with confidence: 75 or above High, 55 to 74 Medium, below 55 Low.',
    '- Theme: keep the item theme unless it is clearly wrong, then pick the closest from: ' + THEMES[pack].join(', ') + '.',
    '- Story: one user story, "As a ..., I want ..., so that ...", written from the item description and requester type.',
    '- Acceptance: two acceptance criteria, "Given ..., when ..., then ..." form.',
    'Return strict JSON only, one object per item, no extra text: {"scores": [{"id": "...", "theme": "...", "reach": 0, "impact": 0, "confidence": 0, "effort": 0, "rice": 0, "kpi": "...", "kpi_reason": "...", "kpi_confidence": "High", "low_evidence": false, "reach_confidence": "High", "story": "...", "acceptance": ["...", "..."]}]}'
  ].join('\n');
}
