// Triage back end stub, Netlify Function.
// Receives items, calls OpenRouter, validates output, logs token usage.
// Set OPENROUTER_API_KEY in Netlify environment variables, never in code.
// No real API key is included in this repo.
export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Use POST' }) };
  }
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }
  const items = Array.isArray(body.items) ? body.items.slice(0, 200) : [];
  const pack = body.pack || 'healthcare';
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    // No key in local dev: fall back to the same rule-based scoring the
    // front end uses, so the function still returns valid JSON.
    return { statusCode: 200, body: JSON.stringify({ pack, model: 'rule-based-fallback', scores: items.map(scoreRuleBased), note: 'Set OPENROUTER_API_KEY to use a live model.' }) };
  }
  // Live model path: one structured call per batch of 25 items.
  // Prompt text lives in prompts/scoring.md, versioned in the repo.
  // The model must return strict JSON: [{id, theme, reach, impact, confidence, effort, rice, low_evidence, reason}]
  const scores = [];
  let inputTokens = 0, outputTokens = 0;
  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25);
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
          { role: 'system', content: 'Score product backlog items with RICE and confidence. Return strict JSON only. See prompts/scoring.md for the rubric.' },
          { role: 'user', content: JSON.stringify(batch) }
        ],
        response_format: { type: 'json_object' }
      })
    });
    if (!res.ok) {
      return { statusCode: 502, body: JSON.stringify({ error: 'OpenRouter error', status: res.status }) };
    }
    const data = await res.json();
    inputTokens += data.usage ? data.usage.prompt_tokens || 0 : 0;
    outputTokens += data.usage ? data.usage.completion_tokens || 0 : 0;
    let parsed = [];
    try { parsed = JSON.parse(data.choices[0].message.content).scores || JSON.parse(data.choices[0].message.content); } catch {}
    for (const s of parsed) {
      if (validateScore(s)) scores.push(s);
    }
  }
  const costUsd = (inputTokens * 0.000003) + (outputTokens * 0.000015);
  return { statusCode: 200, body: JSON.stringify({ pack, model: 'anthropic/claude-sonnet-4', scores, usage: { inputTokens, outputTokens, costUsd } }) };
}

function validateScore(s) {
  if (!s || typeof s.id !== 'string') return false;
  if (typeof s.rice !== 'number' || s.rice < 0) return false;
  if (typeof s.confidence !== 'number' || s.confidence < 0 || s.confidence > 100) return false;
  if (typeof s.theme !== 'string' || !s.theme) return false;
  return true;
}

function scoreRuleBased(it) {
  const conf = it.evidence_strength === 'High' ? 85 : it.evidence_strength === 'Medium' ? 65 : 40;
  const rice = Math.round((it.impact * it.impact * conf / 100 / Math.max(1, it.effort)) * 10);
  return { id: it.id, theme: it.theme, reach: it.impact, impact: it.impact, confidence: conf, effort: it.effort, rice, low_evidence: it.evidence_strength === 'Low', reason: 'Rule-based fallback, no model key set.' };
}
