# Setup checklist, for the friend

This checklist is for the collaborator who owns the Lenny Product Pass accounts. Claim codes in this order, and keep every key in back end environment variables only. Never share a key in chat, email, or in the repo. Never commit a `.env` file.

## 1. OpenRouter, Insider only, $100 in credits

- Claim OpenRouter in the Lenny Product Pass dashboard, under your own account, as a new customer.
- What you get: one year with no platform fees, plus $100 in OpenRouter credits.
- Create an API key in OpenRouter, name it `triage-copilot`.
- Set `OPENROUTER_API_KEY` in Netlify or Railway, for the back end only.
- Test with one small triage run and check usage in OpenRouter. At $0.0192 per item, $100 covers about 26 full 200-item runs at Claude-like pricing, more if you use a cheaper model for bulk triage.

## 2. Supabase Pro, Insider only

- Claim Supabase Pro in the Product Pass dashboard, under your own account.
- Create a project named `triage-copilot`.
- Apply `supabase/schema.sql` in the SQL editor. See `supabase/README.md`.
- Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in Netlify or Railway. The service role key is back end only.
- Load `data/*.json` into the `items` table.

## 3. Railway, for the back end host, optional

- Claim Railway in the Product Pass dashboard.
- Use Railway instead of Netlify Functions if you prefer a long-running server, or keep Netlify Functions and skip Railway.
- If you use Railway, set the same environment variables there.

## 4. Google AI Pro, Insider only, backup model

- Claim Google AI Pro in the Product Pass dashboard.
- In Google AI Studio, claim the $10 a month in Google Cloud credits for the Gemini API. You must prepay at least $5 on a Cloud billing account first to draw down those credits.
- Use Gemini as the backup model if OpenRouter is down, or to compare accuracy on the eval sets.

## 5. Netlify, front end and functions

- Netlify Free is $0, 300 credits a month, enough for a demo. Personal is $9 a month for 1,000 credits, Pro is $20 a month for 3,000 credits.
- Connect the GitHub repo to Netlify for auto deploys.
- Set the same environment variables in Netlify, under Site settings, Environment variables.
- Do not use Netlify AI Gateway for model calls. It adds a markup. Call OpenRouter directly from the function.

## 6. GitHub

- Account: konstantin-abadjiev, repo: triage-copilot, public.
- Add the collaborator once his GitHub username is known: Settings, Collaborators, Add people.
- Protect the main branch: require a pull request review before merging.

## 7. What not to do

- Do not share Product Pass codes. They are personal use only and cannot be shared, sold, or transferred. The collaborator who owns the pass claims them under his own account and hosts the back end himself.
- Do not paste an API key into chat, email, a doc, or a GitHub issue.
- Do not commit `.env`. Check `.gitignore` covers it before the first push.
