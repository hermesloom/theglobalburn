#!/usr/bin/env node
/**
 * Extracts failed webhook event data from misc/stripe-webhook-failures.txt
 * for manual remediation. Run after: npm run stripe:webhook-failures
 *
 * Output: misc/webhook-remediation-data.json
 * Use with verify-webhook-affected-users.sql results to identify who needs remediation.
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const inputPath = join(repoRoot, "misc/stripe-webhook-failures.txt");
const outputPath = join(repoRoot, "misc/webhook-remediation-data.json");

function extractFailedEventsJson(content) {
  const match = content.match(
    /--- Failed Events[\s\S]*?---\s*\n\s*(\{[\s\S]*?\n\})\s*\n/
  );
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function main() {
  let content;
  try {
    content = readFileSync(inputPath, "utf8");
  } catch (e) {
    console.error("Failed to read", inputPath, e.message);
    process.exit(1);
  }

  const list = extractFailedEventsJson(content);
  if (!list?.data?.length) {
    console.error("No failed events found in", inputPath);
    process.exit(1);
  }

  const entries = list.data
    .filter((ev) => ev.data?.object?.object === "checkout.session")
    .map((ev) => {
      const session = ev.data.object;
      const pi =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;
      const memberId = session.metadata?.membership_purchase_right_id;
      const amount =
        session.amount_total != null
          ? session.currency?.toUpperCase() === "SEK" ||
            session.currency?.toLowerCase() === "sek"
            ? session.amount_total / 100
            : session.amount_total
          : null;
      return {
        event_id: ev.id,
        payment_intent: pi,
        membership_purchase_right_id: memberId,
        amount_total: session.amount_total,
        price: amount,
        price_currency: session.currency?.toUpperCase() ?? session.currency,
        customer_email: session.customer_email ?? session.customer_details?.email,
        customer_name: session.customer_details?.name,
      };
    });

  const output = {
    generated_at: new Date().toISOString(),
    source: "misc/stripe-webhook-failures.txt",
    instructions:
      "Run verify-webhook-affected-users.sql on production. For payment_intents with no membership row, use burn_membership_purchase_rights (id = membership_purchase_right_id) to get owner_id, first_name, last_name, birthdate. Then INSERT into burn_memberships.",
    failed_events: entries,
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");
  console.log("Wrote", outputPath, "with", entries.length, "entries");
}

main();
