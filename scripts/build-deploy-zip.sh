#!/bin/bash
# Build the deploy ZIP for the Netlify Drop site.
#
# Usage: ./scripts/build-deploy-zip.sh [output.zip]
# Default output: ~/workspace/triage-copilot-site.zip
#
# What it does:
#   1. Copies the starter tree to a throwaway directory (the starter
#      itself is never modified).
#   2. Zips the copy for upload to the Netlify Drop site.
#
# No secret is injected into the site. The functions are gated by a
# site-origin check (see netlify/functions/lib/auth.mjs), so the front
# end sends no secret and nothing secret is ever baked into index.html.
# The TRIAGE_SHARED_SECRET environment variable is no longer used and
# can be deleted from Netlify Site settings > Environment variables.
set -euo pipefail
OUT="${1:-$HOME/workspace/triage-copilot-site.zip}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
if [ ! -f "$SRC/index.html" ] || [ ! -d "$SRC/netlify/functions" ]; then
  echo "Starter tree looks incomplete (missing index.html or netlify/functions); refusing to build." >&2
  exit 1
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -r "$SRC" "$TMP/site"
# Never ship a .git directory or local env files if they ever appear.
rm -rf "$TMP/site/.git" "$TMP/site/.env"
(cd "$TMP/site" && zip -qr "$OUT" .)
echo "Built $OUT"
