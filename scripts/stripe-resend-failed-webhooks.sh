#!/usr/bin/env bash
# Validates failed webhook events, resends them via Stripe CLI, and verifies they succeed.
# Requires: stripe login (live), jq
# Usage: npm run stripe:resend-failed-webhooks
#
# IMPORTANT: events resend requires a secret key (sk_live_...), not a restricted key.
# If you get "does not have the required permissions", pass the secret key:
#   STRIPE_API_KEY=sk_live_xxx npm run stripe:resend-failed-webhooks
# (Get it from burn_config.stripe_secret_api_key or Stripe Dashboard > API Keys > Secret key)
#
# The 9 event IDs come from misc/webhook-remediation-data.json.

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_FILE="$REPO_ROOT/misc/webhook-remediation-data.json"
EVENT_IDS=$(jq -r '.failed_events[].event_id' "$DATA_FILE" 2>/dev/null | tr '\n' ' ')
EVENT_IDS_ARR=($EVENT_IDS)

if [[ -z "$EVENT_IDS" || "$EVENT_IDS" == "null" ]]; then
  echo "Error: Could not read event IDs from $DATA_FILE"
  exit 1
fi

# Use secret key if provided (required for events resend - restricted keys lack permission)
API_ARGS=()
[[ -n "$STRIPE_API_KEY" ]] && API_ARGS=(--api-key "$STRIPE_API_KEY")

# Get webhook endpoint ID (required for resend; CLI defaults to local stripe listen only)
if [[ -z "$STRIPE_WEBHOOK_ENDPOINT" ]]; then
  ENDPOINTS_JSON=$(stripe webhook_endpoints list "${API_ARGS[@]}" --live 2>&1)
  STRIPE_WEBHOOK_ENDPOINT=$(echo "$ENDPOINTS_JSON" | jq -r '.data[] | select(.status=="enabled" and (.enabled_events | index("checkout.session.completed"))) | .id' 2>/dev/null | head -1)
fi
if [[ -z "$STRIPE_WEBHOOK_ENDPOINT" || "$STRIPE_WEBHOOK_ENDPOINT" == "null" ]]; then
  echo "Error: Could not find enabled webhook endpoint for checkout.session.completed. Set STRIPE_WEBHOOK_ENDPOINT (e.g. we_xxx) or check stripe webhook_endpoints list --live"
  exit 1
fi

echo "=== Stripe Webhook Resend ==="
echo "Webhook endpoint: $STRIPE_WEBHOOK_ENDPOINT"
echo "Events to process: ${#EVENT_IDS_ARR[@]}"
echo ""

# Step 1: Validate current status - list failed events
echo "--- Step 1: Checking that events are currently failed ---"
FAILED_JSON=$(stripe events list "${API_ARGS[@]}" --delivery-success=false --live --limit=100 2>&1)
FAILED_IDS=$(echo "$FAILED_JSON" | jq -r '.data[].id // empty' 2>/dev/null)

FOUND=0
for evt in "${EVENT_IDS_ARR[@]}"; do
  if echo "$FAILED_IDS" | grep -q "^${evt}$"; then
    echo "  ✓ $evt is failed (expected)"
    ((FOUND++)) || true
  else
    echo "  ⚠ $evt not in failed list (may already be succeeded)"
  fi
done
echo "  Found $FOUND of ${#EVENT_IDS_ARR[@]} events in failed list"
echo ""

# Resolve webhook endpoint (required for resend - CLI defaults to stripe listen endpoints)
if [[ -n "$STRIPE_WEBHOOK_ENDPOINT" ]]; then
  WEBHOOK_ENDPOINT="$STRIPE_WEBHOOK_ENDPOINT"
else
  # Auto-detect: first enabled endpoint with checkout.session.completed
  ENDPOINTS_JSON=$(stripe webhook_endpoints list "${API_ARGS[@]}" --live 2>&1)
  WEBHOOK_ENDPOINT=$(echo "$ENDPOINTS_JSON" | jq -r '[.data[] | select(.status=="enabled") | select(.enabled_events[]? == "checkout.session.completed" or .enabled_events[]? == "*")] | .[0].id // empty')
  if [[ -z "$WEBHOOK_ENDPOINT" ]]; then
    echo "Error: No webhook endpoint found. Set STRIPE_WEBHOOK_ENDPOINT (e.g. we_xxx) or ensure an enabled endpoint exists."
    exit 1
  fi
  echo "Using webhook endpoint: $WEBHOOK_ENDPOINT"
  echo ""
fi

# Step 2: Resend each event
echo "--- Step 2: Resending events ---"
for evt in "${EVENT_IDS_ARR[@]}"; do
  echo "  Resending $evt ..."
  stripe events resend "$evt" "${API_ARGS[@]}" --live --confirm --webhook-endpoint "$WEBHOOK_ENDPOINT" 2>&1 || echo "    (resend may have failed)"
done
echo ""

# Step 3: Wait for delivery
echo "--- Step 3: Waiting 10s for deliveries ---"
sleep 10
echo ""

# Step 4: Validate status after resend
echo "--- Step 4: Checking that events are now succeeded ---"
FAILED_JSON_AFTER=$(stripe events list "${API_ARGS[@]}" --delivery-success=false --live --limit=100 2>&1)
FAILED_IDS_AFTER=$(echo "$FAILED_JSON_AFTER" | jq -r '.data[].id // empty' 2>/dev/null)

STILL_FAILED=0
for evt in "${EVENT_IDS_ARR[@]}"; do
  if echo "$FAILED_IDS_AFTER" | grep -q "^${evt}$"; then
    echo "  ✗ $evt still failed"
    ((STILL_FAILED++)) || true
  else
    echo "  ✓ $evt succeeded (no longer in failed list)"
  fi
done

echo ""
if [[ $STILL_FAILED -gt 0 ]]; then
  echo "Result: $STILL_FAILED events still failed. Check Stripe Dashboard > Developers > Webhooks > Failed events."
  exit 1
else
  echo "Result: All ${#EVENT_IDS_ARR[@]} events now succeeded."
fi
