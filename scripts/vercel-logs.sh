#!/usr/bin/env bash
# Fetches Vercel runtime logs and writes to misc/vercel-log.txt
# Usage: npm run vercel:logs [-- 14]  (optional: days to look back, default 7)
# Extra vercel logs options can be passed: npm run vercel:logs -- 14 -- --level error
#
# IMPORTANT: Project-level logs default to branch "main", but production uses
# "production". We fetch from the production deployment URL to get webhook logs
# (including POST /api/webhooks/stripe, PGRST116, "Failed to execute query").

DAYS=${1:-7}
[ -n "${1:-}" ] && shift
EXTRA_OPTS=("$@")
OUTPUT=misc/vercel-log.txt

# Resolve production deployment URL (members.theborderland.se hits this)
PROD_URL=$(vercel list --no-color 2>&1 | grep "Production" | head -1 | grep -oE 'https://[a-zA-Z0-9.-]+\.vercel\.app' | head -1)

mkdir -p misc
{
  echo "=== Vercel Runtime Logs (last $DAYS days) ==="
  echo "Generated: $(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')"
  echo ""

  if [ -n "$PROD_URL" ]; then
    echo "--- Production deployment logs ($PROD_URL) — includes Stripe webhook failures ---"
    vercel logs "$PROD_URL" --no-follow --since "${DAYS}d" --expand --limit 500 2>&1

    echo ""
    echo "--- Production: error-level logs (PGRST116, Failed to execute query, etc.) ---"
    vercel logs "$PROD_URL" --no-follow --since "${DAYS}d" --expand --limit 200 --level error 2>&1

    echo ""
    echo "--- Production: 400 responses (webhook failures) ---"
    vercel logs "$PROD_URL" --no-follow --since "${DAYS}d" --expand --limit 100 --status-code 400 2>&1
  else
    echo "--- Could not resolve production URL; falling back to project logs ---"
  fi

  echo ""
  echo "--- Project-level logs (branch main) ---"
  vercel logs --since "${DAYS}d" --expand --limit 200 "${EXTRA_OPTS[@]}" 2>&1
} 2>&1 | tee "$OUTPUT"

echo ""
echo "--- Stripe webhook related (grep from full log) ---"
grep -i -E "webhook|stripe|/api/webhooks|PGRST116|Failed to execute query" "$OUTPUT" 2>/dev/null || echo "(no matches)"

echo ""
echo "--- Stripe webhook delivery failures (from Stripe API; cross-ref with Vercel logs above) ---"
if command -v stripe >/dev/null 2>&1; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  bash "$SCRIPT_DIR/stripe-webhook-failures.sh" "$DAYS" 2>&1 | tee -a "$OUTPUT"
else
  msg="(Stripe CLI not found; run: npm run stripe:webhook-failures $DAYS)"
  echo "$msg"
  echo "$msg" >> "$OUTPUT"
fi
echo ""
echo "Vercel logs + Stripe webhook failures written to $OUTPUT"
