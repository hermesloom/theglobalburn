import { describe, expect, it } from "vitest";
import { SYNC_RESOURCES, SYNC_START_ISO } from "@/utils/stripe/sync";

const ACCOUNT = "acct_19mA4pEuBjGnolU2";
const resource = (name: string) => SYNC_RESOURCES.find((r) => r.name === name)!;

describe("sync resources", () => {
  it("starts at the first month Checkout Sessions exist", () => {
    expect(SYNC_START_ISO).toBe("2025-02-01T00:00:00.000Z");
  });

  it("maps a checkout session, lifting the purchase right id out of metadata", () => {
    const mapped = resource("checkout_sessions").map(
      {
        id: "cs_live_a1",
        created: 1764500000,
        status: "complete",
        payment_status: "paid",
        amount_total: 222200,
        amount_subtotal: 222200,
        currency: "sek",
        payment_intent: "pi_3SZJoY",
        customer_email: "someone@example.com",
        metadata: {
          membership_purchase_right_id: "80113518-5ad8-4778-8bf6-1cd8c95c1eda",
        },
        line_items: {
          data: [
            {
              description: "Membership for The Borderland 2026",
              amount_total: 222200,
              quantity: 1,
            },
          ],
        },
      },
      ACCOUNT,
    );
    expect(mapped.id).toBe("cs_live_a1");
    expect(mapped.stripe_account_id).toBe(ACCOUNT);
    expect(mapped.created_at).toBe(new Date(1764500000 * 1000).toISOString());
    expect(mapped.payment_intent_id).toBe("pi_3SZJoY");
    expect(mapped.membership_purchase_right_id).toBe(
      "80113518-5ad8-4778-8bf6-1cd8c95c1eda",
    );
    expect(mapped.line_items).toEqual([
      {
        description: "Membership for The Borderland 2026",
        amount_total: 222200,
        quantity: 1,
      },
    ]);
  });

  it("tolerates a session with no metadata and no payment intent", () => {
    const mapped = resource("checkout_sessions").map(
      {
        id: "cs_live_a2",
        created: 1764500000,
        status: "expired",
        payment_status: "unpaid",
        currency: "sek",
        metadata: {},
      },
      ACCOUNT,
    );
    expect(mapped.membership_purchase_right_id).toBeNull();
    expect(mapped.payment_intent_id).toBeNull();
  });

  it("maps an expanded payment_intent object down to its id", () => {
    const mapped = resource("checkout_sessions").map(
      {
        id: "cs_live_a3",
        created: 1764500000,
        currency: "sek",
        metadata: {},
        payment_intent: { id: "pi_expanded" },
      },
      ACCOUNT,
    );
    expect(mapped.payment_intent_id).toBe("pi_expanded");
  });

  it("maps a charge including its card details", () => {
    const mapped = resource("charges").map(
      {
        id: "ch_3TssXg",
        created: 1783982501,
        payment_intent: "pi_3TssXg",
        amount: 222200,
        amount_refunded: 0,
        amount_captured: 222200,
        currency: "sek",
        status: "succeeded",
        paid: true,
        refunded: false,
        disputed: false,
        balance_transaction: "txn_3TssXg",
        billing_details: { email: "johan@example.se" },
        payment_method_details: { card: { country: "SE", brand: "mastercard" } },
      },
      ACCOUNT,
    );
    expect(mapped.balance_transaction_id).toBe("txn_3TssXg");
    expect(mapped.card_country).toBe("SE");
    expect(mapped.card_brand).toBe("mastercard");
    expect(mapped.billing_email).toBe("johan@example.se");
  });

  it("maps a balance transaction with its fee details", () => {
    const mapped = resource("balance_transactions").map(
      {
        id: "txn_1",
        created: 1783982501,
        available_on: 1784000000,
        type: "charge",
        reporting_category: "charge",
        amount: 222200,
        fee: 3513,
        net: 218687,
        currency: "sek",
        source: "ch_3TssXg",
        fee_details: [
          {
            type: "stripe_fee",
            amount: 3513,
            description: "Stripe processing fees",
          },
        ],
      },
      ACCOUNT,
    );
    expect(mapped.fee).toBe(3513);
    expect(mapped.source_id).toBe("ch_3TssXg");
    expect(mapped.available_on).toBe(new Date(1784000000 * 1000).toISOString());
  });

  it("maps a dispute's balance transactions to an id array", () => {
    const mapped = resource("disputes").map(
      {
        id: "du_1",
        created: 1780000000,
        charge: "ch_3T9T6D",
        payment_intent: "pi_3T9T6D",
        amount: 222200,
        currency: "sek",
        status: "under_review",
        reason: "credit_not_processed",
        is_charge_refundable: false,
        balance_transactions: [{ id: "txn_dispute_1" }, { id: "txn_dispute_2" }],
      },
      ACCOUNT,
    );
    expect(mapped.balance_transaction_ids).toEqual([
      "txn_dispute_1",
      "txn_dispute_2",
    ]);
  });

  it("maps a payout's arrival date", () => {
    const mapped = resource("payouts").map(
      {
        id: "po_1",
        created: 1775000000,
        arrival_date: 1775200000,
        amount: -600000000,
        currency: "sek",
        status: "paid",
        method: "standard",
        description: "",
      },
      ACCOUNT,
    );
    expect(mapped.arrival_date).toBe(new Date(1775200000 * 1000).toISOString());
  });

  it("syncs sessions before charges, because charges are refreshed by reference", () => {
    const names = SYNC_RESOURCES.map((r) => r.name);
    expect(names.indexOf("checkout_sessions")).toBeLessThan(
      names.indexOf("charges"),
    );
    expect(names.indexOf("refunds")).toBeLessThan(
      names.indexOf("balance_transactions"),
    );
  });
});
