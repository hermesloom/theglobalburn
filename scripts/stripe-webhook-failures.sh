#!/usr/bin/env bash
# Fetches Stripe webhook delivery failures and writes to misc/stripe-webhook-failures.txt
# Usage: npm run stripe:webhook-failures [-- 7]  (optional: days to look back, default 7)

DAYS=${1:-7}
TS=$(node -p "Math.floor(Date.now()/1000) - $DAYS * 86400")
OUTPUT=misc/stripe-webhook-failures.txt

mkdir -p misc
{
  echo "=== Stripe Webhook Delivery Failures (last $DAYS days) ==="
  echo "Generated: $(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')"
  echo ""

  echo "--- Webhook Endpoints (live) ---"
  stripe webhook_endpoints list --live 2>&1

  echo ""
  echo "--- Failed Events (delivery_success=false, created >= $DAYS days ago) ---"
  FAILED_JSON=$(stripe events list --delivery-success=false --live -d "created[gte]=$TS" --limit=100 2>&1)
  echo "$FAILED_JSON"

  echo ""
  echo "--- Full details for each failed event ---"
  for id in $(echo "$FAILED_JSON" | jq -r '.data[].id // empty' 2>/dev/null); do
    echo "### Event: $id ###"
    stripe events retrieve "$id" --live 2>&1
    echo ""
  done
} 2>&1 | tee "$OUTPUT"
