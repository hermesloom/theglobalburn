#!/usr/bin/env node
/**
 * Reconstructs burn_membership_transfers rows for transfers that happened before
 * the table existed (migration 20260303130000; earliest real row 2026-03-14).
 *
 * A transfer leaves two traces: a partial refund on the old owner's payment, and a
 * new membership created in the same webhook request. Those timestamps are seconds
 * apart, which is what lets the two sides be paired.
 *
 * Reports by default. Pass --apply to insert.
 *
 * Usage:
 *   node scripts/backfill-membership-transfers.mjs --project the-borderland-2026
 *   node scripts/backfill-membership-transfers.mjs --project the-borderland-2026 --apply
 */

import { readFileSync } from "fs";
import { join } from "path";

function loadEnv() {
  try {
    const env = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of env.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1).replace(/\\(.)/g, "$1");
      }
      process.env[match[1].trim()] = value;
    }
  } catch {}
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
  process.exit(1);
}

/** The migration that created burn_membership_transfers. Live rows exist after this. */
const TABLE_LIVE_FROM = "2026-03-14T00:00:00Z";
/** How close in time a refund and a new membership must be to be one transfer. */
const PAIRING_WINDOW_MS = 10_000;

const args = process.argv.slice(2);
const projectSlug = args[args.indexOf("--project") + 1];
const apply = args.includes("--apply");
if (!projectSlug || projectSlug.startsWith("--")) {
  console.error("--project <slug> is required");
  process.exit(1);
}

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

/** Fetches every row of a table, paging past PostgREST's default limit. */
async function all(path) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await rest(
      `${path}${path.includes("?") ? "&" : "?"}limit=1000&offset=${offset}`,
    );
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

const [project] = await rest(`projects?slug=eq.${projectSlug}&select=id,slug`);
if (!project) {
  console.error(`No project with slug ${projectSlug}`);
  process.exit(1);
}

const [burnConfig] = await rest(
  `burn_config?project_id=eq.${project.id}&select=membership_addons,membership_price_currency`,
);
// burn_config stores display units; the Stripe mirror stores minor units.
const MINOR = ["JPY", "KRW", "VND", "CLP"].includes(
  (burnConfig?.membership_price_currency ?? "SEK").toUpperCase(),
)
  ? 1
  : 100;
const ALVERSJO_MINOR = Math.round(
  ((burnConfig?.membership_addons ?? []).find(
    (a) => a.id === "alversjo-membership",
  )?.price ?? 0) * MINOR,
);

const payments = await all(
  `stripe_membership_payments?select=*&project_id=eq.${project.id}`,
);
const refunds = await all(`stripe_refunds?select=*&status=eq.succeeded`);
const purchaseRights = await all(
  `burn_membership_purchase_rights?select=id,owner_id,first_name,last_name,birthdate,metadata&project_id=eq.${project.id}`,
);
const memberships = await all(
  `burn_memberships?select=id,owner_id,created_at,stripe_payment_intent_id&project_id=eq.${project.id}`,
);
const existing = await all(
  `burn_membership_transfers?select=*&project_id=eq.${project.id}`,
);

const sessionByPi = new Map(
  payments.filter((p) => p.payment_intent_id).map((p) => [p.payment_intent_id, p]),
);
const rightById = new Map(purchaseRights.map((r) => [r.id, r]));
const sessionRightByPi = new Map();
{
  const sessions = await all(
    `stripe_checkout_sessions?select=payment_intent_id,membership_purchase_right_id&payment_status=eq.paid`,
  );
  for (const s of sessions) {
    if (s.payment_intent_id && s.membership_purchase_right_id) {
      sessionRightByPi.set(s.payment_intent_id, s.membership_purchase_right_id);
    }
  }
}

/**
 * Candidate transfers: payment intents with a partial refund that is not simply the
 * Alversjö addon being cancelled. Full refunds are returns, not transfers.
 */
function candidates() {
  const byPi = new Map();
  for (const r of refunds) {
    if (!r.payment_intent_id) continue;
    if (!byPi.has(r.payment_intent_id)) byPi.set(r.payment_intent_id, []);
    byPi.get(r.payment_intent_id).push(r);
  }

  const out = [];
  for (const [pi, rs] of byPi) {
    const payment = sessionByPi.get(pi);
    if (!payment) continue; // another burn, or the demo project
    const refundedTotal = rs.reduce((a, r) => a + r.amount, 0);
    if (refundedTotal >= payment.amount_total) continue; // a return
    const isAddonOnly =
      payment.has_alversjo &&
      ALVERSJO_MINOR > 0 &&
      rs.every((r) => r.amount === ALVERSJO_MINOR);
    if (isAddonOnly) continue;
    const latest = rs.reduce((a, b) =>
      Date.parse(a.created_at) > Date.parse(b.created_at) ? a : b,
    );
    out.push({
      paymentIntentId: pi,
      payment,
      refundedTotal,
      refundedAt: Date.parse(latest.created_at),
    });
  }
  return out.sort((a, b) => a.refundedAt - b.refundedAt);
}

/** Pairs each candidate with the membership created in the same webhook request. */
function pair(cands) {
  const used = new Set();
  return cands.map((c) => {
    const rightId = sessionRightByPi.get(c.paymentIntentId);
    const right = rightId ? rightById.get(rightId) : null;

    let best = null;
    let bestDelta = Infinity;
    for (const m of memberships) {
      if (used.has(m.id)) continue;
      const delta = Math.abs(Date.parse(m.created_at) - c.refundedAt);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = m;
      }
    }
    const matched = best && bestDelta <= PAIRING_WINDOW_MS ? best : null;
    if (matched) used.add(matched.id);

    return {
      ...c,
      fromOwnerId: right?.owner_id ?? null,
      toOwnerId: matched?.owner_id ?? null,
      right,
      deltaMs: matched ? bestDelta : null,
    };
  });
}

const paired = pair(candidates());

// --- Validation gate -------------------------------------------------------
// Re-derive the transfers that the table already holds. The algorithm must
// reproduce them exactly before it is trusted with the ones it does not.
const liveFrom = Date.parse(TABLE_LIVE_FROM);
const derivedLive = paired.filter((p) => p.refundedAt >= liveFrom);
const existingByFromTo = new Map(
  existing.map((e) => [
    `${e.from_owner_id}|${e.to_owner_id}|${Math.round(e.refund_amount * MINOR)}`,
    e,
  ]),
);

let matched = 0;
const mismatches = [];
for (const d of derivedLive) {
  const key = `${d.fromOwnerId}|${d.toOwnerId}|${d.refundedTotal}`;
  if (existingByFromTo.has(key)) matched++;
  else mismatches.push(d);
}

console.log(`Project: ${project.slug}`);
console.log(`Existing transfer rows: ${existing.length}`);
console.log(`Candidates derived from Stripe: ${paired.length}`);
console.log(
  `Validation (after ${TABLE_LIVE_FROM}): derived ${derivedLive.length}, matched ${matched}, mismatched ${mismatches.length}`,
);

if (mismatches.length > 0) {
  console.error("\nValidation FAILED. The algorithm does not reproduce known rows:");
  for (const m of mismatches.slice(0, 10)) {
    console.error(
      `  pi=${m.paymentIntentId} from=${m.fromOwnerId} to=${m.toOwnerId} refunded=${m.refundedTotal} delta=${m.deltaMs}ms`,
    );
  }
  console.error("\nNothing was inserted. Investigate before re-running.");
  process.exit(1);
}

// --- Backfill --------------------------------------------------------------
const existingPis = new Set(
  existing
    .map((e) => e.original_membership_json?.stripe_payment_intent_id)
    .filter(Boolean),
);
const toInsert = [];
const unresolved = [];

for (const p of paired) {
  if (p.refundedAt >= liveFrom) continue; // already covered by live rows
  if (existingPis.has(p.paymentIntentId)) continue; // idempotent
  if (!p.fromOwnerId || !p.toOwnerId) {
    unresolved.push(p);
    continue;
  }
  toInsert.push({
    project_id: project.id,
    from_owner_id: p.fromOwnerId,
    to_owner_id: p.toOwnerId,
    // burn_membership_transfers.refund_amount is a float in display units
    refund_amount: p.refundedTotal / MINOR,
    price_currency: p.payment.currency,
    created_at: new Date(p.refundedAt).toISOString(),
    original_membership_json: {
      stripe_payment_intent_id: p.paymentIntentId,
      first_name: p.right?.first_name ?? null,
      last_name: p.right?.last_name ?? null,
      birthdate: p.right?.birthdate ?? null,
      price: p.payment.amount_total / MINOR,
      price_currency: p.payment.currency,
      metadata: p.right?.metadata ?? null,
    },
    metadata: { reconstructed: true },
  });
}

console.log(`\nTo insert: ${toInsert.length}`);
console.log(`Unresolved (reported, not guessed): ${unresolved.length}`);
for (const u of unresolved.slice(0, 20)) {
  console.log(
    `  pi=${u.paymentIntentId} refundedAt=${new Date(u.refundedAt).toISOString()} from=${u.fromOwnerId ?? "?"} to=${u.toOwnerId ?? "?"}`,
  );
}

if (!apply) {
  console.log("\nDry run. Re-run with --apply to insert.");
  process.exit(0);
}

for (let i = 0; i < toInsert.length; i += 100) {
  await rest("burn_membership_transfers", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(toInsert.slice(i, i + 100)),
  });
  console.log(`inserted ${Math.min(i + 100, toInsert.length)}/${toInsert.length}`);
}
console.log("Done.");
