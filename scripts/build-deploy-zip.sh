#!/bin/bash
# Build the deploy ZIP for the Netlify Drop site.
#
# Usage: TRIAGE_SHARED_SECRET=<secret from Netlify env vars> ./scripts/build-deploy-zip.sh [output-zip]
# Default output: ~/workspace/triage-copilot-site.zip
#
# What it does:
#   1. Copies the starter tree to a throwaway directory (the starter
#      itself is never modified, so the placeholder stays in the repo).
#   2. Replaces the __TRIAGE_SHARED_SECRET__ placeholder in index.html
#      with the real secret, so the deployed front end can call the
#      functions. The secret is never written to any file in the repo
#      and never printed.
#   3. Zips the copy for upload to the Netlify Drop site.
#
# The secret must also be set as TRIAGE_SHARED_SECRET in Netlify Site
# settings > Environment variables, so the functions accept it. If the
# ZIP is built without the secret, the deployed front end shows
# "This deploy is misconfigured" and calls no function.
set -euo pipefail
OUT="${1:-$HOME/workspace/triage-copilot-site.zip}"
if [ -z "${TRIAGE_SHARED_SECRET:-}" ]; then
  echo "TRIAGE_SHARED_SECRET is not set. Set it from the Netlify environment variable and re-run." >&2
  exit 1
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
SRC="$(cd "$(dirname "$0")/.." && pwd)"
cp -r "$SRC" "$TMP/site"
# Never ship a .git directory or local env files if they ever appear.
rm -rf "$TMP/site/.git" "$TMP/site/.env"
python3 - "$TMP/site/index.html" "$TRIAGE_SHARED_SECRET" <<'PYEOF'
import json, sys
path, secret = sys.argv[1], sys.argv[2]
with open(path, encoding='utf-8') as f:
    html = f.read()
# Replace ONLY the assignment. The other two occurrences of the
# placeholder (the comment and the triageSecretConfigured() comparison)
# must stay: replacing the comparison would make it compare the secret
# to itself and block every function call.
target = "var TRIAGE_SHARED_SECRET = '__TRIAGE_SHARED_SECRET__';"
if target not in html:
    print('Placeholder assignment not found in index.html; refusing to build.', file=sys.stderr)
    sys.exit(1)
replacement = 'var TRIAGE_SHARED_SECRET = ' + json.dumps(secret) + ';'
with open(path, 'w', encoding='utf-8') as f:
    f.write(html.replace(target, replacement, 1))
PYEOF
(cd "$TMP/site" && zip -qr "$OUT" .)
echo "Built $OUT"
