import { describe, expect, it } from "vitest";
import {
  aggregateFinances,
  classifySale,
  splitPayment,
} from "@/utils/stripe/attribution";
import { MembershipPaymentRow } from "@/utils/stripe/types";

const EVENT_END = new Date("2026-07-26T12:00:00Z"); // The Borderland 2026
const ALVERSJO = 60_000; // 600 SEK in öre

function row(over: Partial<MembershipPaymentRow> = {}): MembershipPaymentRow {
  return {
    session_id: "cs_live_test",
    payment_intent_id: "pi_test",
    paid_at: "2026-03-15T12:00:00Z",
    project_id: "06101baf-5991-42b1-b2f5-caa9fd6b90e2",
    owner_id: "owner-default",
    currency: "SEK",
    amount_total: 222_200,
    fee: 3_513,
    fee_refunded: 0,
    disputed_amount: 0,
    dispute_fee: 0,
    has_alversjo: false,
    refunds: [],
    ...over,
  };
}

describe("classifySale", () => {
  it("puts the fall sale opening in fall", () => {
    expect(classifySale(new Date("2025-11-17T16:00:00Z"), EVENT_END)).toBe(
      "fall",
    );
  });

  it("puts the fall sale tail in fall, past the non-transferable window", () => {
    // 237 real payments ran from 2025-11-24 to 2025-12-07, after the
    // open_sale_non_transferable window closed on 2025-11-23.
    expect(classifySale(new Date("2025-12-07T10:00:00Z"), EVENT_END)).toBe(
      "fall",
    );
  });

  it("puts the spring sale opening in spring", () => {
    expect(classifySale(new Date("2026-03-01T09:00:00Z"), EVENT_END)).toBe(
      "spring",
    );
  });

  it("puts transfer-replacement purchases just before the burn in spring", () => {
    expect(classifySale(new Date("2026-07-13T20:00:00Z"), EVENT_END)).toBe(
      "spring",
    );
  });

  it("splits at Stockholm new year, not UTC", () => {
    // 2025-12-31T23:30Z is already 2026-01-01 00:30 in Stockholm (UTC+1)
    expect(classifySale(new Date("2025-12-31T23:30:00Z"), EVENT_END)).toBe(
      "spring",
    );
    expect(classifySale(new Date("2025-12-31T22:30:00Z"), EVENT_END)).toBe(
      "fall",
    );
  });
});

describe("splitPayment", () => {
  it("puts everything in base when there is no Alversjö addon", () => {
    const s = splitPayment(row(), ALVERSJO);
    expect(s.baseGross).toBe(222_200);
    expect(s.alversjoGross).toBe(0);
    expect(s.baseNet).toBe(222_200);
    expect(s.baseFee).toBe(3_513);
    expect(s.alversjoFee).toBe(0);
  });

  it("separates the addon from the base", () => {
    const s = splitPayment(
      row({ amount_total: 282_200, has_alversjo: true, fee: 4_413 }),
      ALVERSJO,
    );
    expect(s.baseGross).toBe(222_200);
    expect(s.alversjoGross).toBe(60_000);
    // fee prorated by amount share: 4413 * 60000/282200 = 938.2 -> 938
    expect(s.alversjoFee).toBe(938);
    expect(s.baseFee).toBe(4_413 - 938);
    expect(s.baseFee + s.alversjoFee).toBe(s.netFee);
  });

  it("attributes an addon-sized refund wholly to Alversjö", () => {
    // Real case: 2822 SEK paid, exactly 600 SEK refunded (Alversjö cancelled alone)
    const s = splitPayment(
      row({
        amount_total: 282_200,
        has_alversjo: true,
        fee: 4_413,
        refunds: [{ amount: 60_000 }],
      }),
      ALVERSJO,
    );
    expect(s.alversjoRefunded).toBe(60_000);
    expect(s.baseRefunded).toBe(0);
    expect(s.alversjoNet).toBe(0);
    expect(s.baseNet).toBe(222_200);
  });

  it("splits a transfer refund proportionally", () => {
    // Real case: 97% transfer refund on a payment that included Alversjö
    const s = splitPayment(
      row({
        amount_total: 282_200,
        has_alversjo: true,
        fee: 4_413,
        refunds: [{ amount: 275_534 }],
      }),
      ALVERSJO,
    );
    // 275534 * 60000/282200 = 58583.4 -> 58583
    expect(s.alversjoRefunded).toBe(58_583);
    expect(s.baseRefunded).toBe(275_534 - 58_583);
    expect(s.baseRefunded + s.alversjoRefunded).toBe(275_534);
  });

  it("handles the 50% + addon refund shape", () => {
    // Real case: 2822 paid, 2011 refunded = 50% of the whole plus the full addon
    const s = splitPayment(
      row({
        amount_total: 282_200,
        has_alversjo: true,
        fee: 4_413,
        refunds: [{ amount: 201_100 }],
      }),
      ALVERSJO,
    );
    expect(s.baseRefunded + s.alversjoRefunded).toBe(201_100);
    expect(s.baseNet + s.alversjoNet).toBe(282_200 - 201_100);
  });

  it("nets fee refunds into the fee", () => {
    const s = splitPayment(row({ fee: 3_513, fee_refunded: -1_200 }), ALVERSJO);
    expect(s.netFee).toBe(3_513 - 1_200);
  });

  it("reports a chargeback separately instead of hiding it in income", () => {
    // Real case: the one disputed 2222 SEK charge, plus its 200 SEK dispute fee.
    const s = splitPayment(
      row({ disputed_amount: 222_200, dispute_fee: 20_000 }),
      ALVERSJO,
    );
    expect(s.baseNet).toBe(222_200); // income untouched
    expect(s.netFee).toBe(3_513); // dispute fee not folded into the fee
    expect(s.chargeback).toBe(242_200); // amount plus fee
  });

  it("treats multiple refunds on one payment independently", () => {
    const s = splitPayment(
      row({
        amount_total: 282_200,
        has_alversjo: true,
        refunds: [{ amount: 60_000 }, { amount: 111_100 }],
      }),
      ALVERSJO,
    );
    // The first refund is addon-sized, so it clears Alversjö's whole 600. The
    // second cannot take any more from Alversjö - it has nothing left to give
    // back - so it falls entirely to the base membership.
    expect(s.alversjoRefunded).toBe(60_000);
    expect(s.baseRefunded).toBe(111_100);
    expect(s.baseRefunded + s.alversjoRefunded).toBe(171_100);
  });

  it("never takes back more from Alversjö than it received", () => {
    // Real shape: 2822 paid, the 600 addon cancelled and refunded on its own,
    // then the membership transferred with a further partial refund. Alversjö
    // must not be charged for the addon twice.
    const s = splitPayment(
      row({
        amount_total: 282_200,
        has_alversjo: true,
        fee: 4_413,
        refunds: [{ amount: 60_000 }, { amount: 141_100 }],
      }),
      ALVERSJO,
    );
    expect(s.alversjoRefunded).toBe(60_000);
    expect(s.alversjoNet).toBe(0);
    // the remainder belongs to the base membership
    expect(s.baseRefunded).toBe(141_100);
    expect(s.baseNet).toBe(222_200 - 141_100);
    expect(s.baseRefunded + s.alversjoRefunded).toBe(201_100);
  });

  it("does not divide by zero on a zero-amount payment", () => {
    const s = splitPayment(row({ amount_total: 0, fee: 0 }), ALVERSJO);
    expect(s.baseNet).toBe(0);
    expect(s.alversjoNet).toBe(0);
  });
});

const PROJECT = "06101baf-5991-42b1-b2f5-caa9fd6b90e2";
function aggregate(
  rows: MembershipPaymentRow[],
  over: Partial<Parameters<typeof aggregateFinances>[0]> = {},
) {
  return aggregateFinances({
    rows,
    projectId: PROJECT,
    alversjoPrice: ALVERSJO,
    eventEndDate: EVENT_END,
    currency: "SEK",
    transfers: [],
    memberships: [],
    lastSyncedAt: "2026-07-28T10:00:00Z",
    ...over,
  });
}

describe("aggregateFinances", () => {
  it("separates fall from spring by payment date", () => {
    const p = aggregate([
      row({ paid_at: "2025-11-17T16:00:00Z", amount_total: 222_200, fee: 3_513 }),
      row({ paid_at: "2026-03-01T09:00:00Z", amount_total: 123_400, fee: 2_031 }),
    ]);
    expect(p.fall.operatingIncome).toBe(222_200);
    expect(p.spring.operatingIncome).toBe(123_400);
    expect(p.total.operatingIncome).toBe(345_600);
    expect(p.fall.payments).toBe(1);
    expect(p.spring.payments).toBe(1);
  });

  it("reports Alversjö as a slice that sums back into operating income", () => {
    const p = aggregate([
      row({
        paid_at: "2026-03-01T09:00:00Z",
        amount_total: 282_200,
        has_alversjo: true,
        fee: 4_413,
      }),
    ]);
    expect(p.spring.alversjoIncome).toBe(60_000);
    expect(p.spring.membershipIncome).toBe(222_200);
    expect(p.spring.membershipIncome + p.spring.alversjoIncome).toBe(
      p.spring.operatingIncome,
    );
  });

  it("nets refunds out of the sale the original payment belongs to", () => {
    const p = aggregate([
      row({
        paid_at: "2026-03-01T09:00:00Z",
        amount_total: 222_200,
        fee: 3_513,
        refunds: [{ amount: 111_100 }],
      }),
    ]);
    expect(p.spring.operatingIncome).toBe(111_100);
    expect(p.spring.refunds).toBe(1);
  });

  it("shows gross and net separately", () => {
    const p = aggregate([
      row({ paid_at: "2026-03-01T09:00:00Z", amount_total: 222_200, fee: 3_513 }),
    ]);
    expect(p.spring.operatingIncome).toBe(222_200);
    expect(p.spring.stripeFees).toBe(3_513);
    expect(p.spring.netKept).toBe(222_200 - 3_513);
  });

    it("counts transfers against the sale of the original membership", () => {
    const p = aggregate(
      [
        row({ payment_intent_id: "pi_fall", paid_at: "2025-11-20T09:00:00Z" }),
        row({ payment_intent_id: "pi_spring", paid_at: "2026-03-20T09:00:00Z" }),
      ],
      {
        transfers: [
          {
            fromPaymentIntentId: "pi_spring",
            toOwnerId: null,
            at: "2026-06-01T00:00:00Z",
          },
        ],
      },
    );
    expect(p.fall.transfers).toBe(0);
    expect(p.spring.transfers).toBe(1);
    expect(p.total.transfers).toBe(1);
  });

      it("reports a negative surplus when the incoming fee exceeds the buffer", () => {
    // B pays with an international card: 74.02 fee against a 66.66 buffer.
    const p = aggregate(
      [
        row({
          payment_intent_id: "pi_A",
          owner_id: "alice",
          paid_at: "2026-03-01T09:00:00Z",
          amount_total: 222_200,
          fee: 3_513,
          refunds: [{ amount: 215_534 }],
        }),
        row({
          payment_intent_id: "pi_B",
          owner_id: "bob",
          paid_at: "2026-06-01T09:00:00Z",
          amount_total: 222_200,
          fee: 7_402,
        }),
      ],
      {
        transfers: [
          { fromPaymentIntentId: "pi_A", toOwnerId: "bob", at: "2026-06-01T09:00:00Z" },
        ],
      },
    );
    expect(p.spring.transferSurplus).toBe(-736); // -7.36 SEK
  });

  it("credits the surplus to the sale the original membership came from", () => {
    const p = aggregate(
      [
        row({
          payment_intent_id: "pi_A",
          owner_id: "alice",
          paid_at: "2025-11-20T09:00:00Z", // fall
          amount_total: 222_200,
          fee: 3_513,
          refunds: [{ amount: 215_534 }],
        }),
        row({
          payment_intent_id: "pi_B",
          owner_id: "bob",
          paid_at: "2026-06-01T09:00:00Z", // spring
          amount_total: 222_200,
          fee: 3_513,
        }),
      ],
      {
        transfers: [
          { fromPaymentIntentId: "pi_A", toOwnerId: "bob", at: "2026-06-01T09:00:00Z" },
        ],
      },
    );
    expect(p.fall.transferSurplus).toBe(3_153);
    expect(p.spring.transferSurplus).toBe(0);
  });

  it("ignores a transfer whose incoming payment cannot be identified", () => {
    const p = aggregate(
      [
        row({
          payment_intent_id: "pi_A",
          owner_id: "alice",
          paid_at: "2026-03-01T09:00:00Z",
          refunds: [{ amount: 215_534 }],
        }),
      ],
      {
        transfers: [
          { fromPaymentIntentId: "pi_A", toOwnerId: "ghost", at: "2026-06-01T09:00:00Z" },
        ],
      },
    );
    expect(p.spring.transferSurplus).toBe(0);
  });

  it("counts memberships against the sale their payment falls in", () => {
    const p = aggregate(
      [
        row({ payment_intent_id: "pi_fall", paid_at: "2025-11-20T09:00:00Z" }),
        row({ payment_intent_id: "pi_spring", paid_at: "2026-03-20T09:00:00Z" }),
      ],
      {
        memberships: [
          { paymentIntentId: "pi_fall", checkedIn: true },
          { paymentIntentId: "pi_spring", checkedIn: false },
        ],
      },
    );
    expect(p.fall.memberships).toBe(1);
    expect(p.fall.checkedIn).toBe(1);
    expect(p.spring.memberships).toBe(1);
    expect(p.spring.checkedIn).toBe(0);
    expect(p.total.memberships).toBe(2);
    expect(p.total.checkedIn).toBe(1);
  });

  it("dates a transferred membership by the payment that acquired it", () => {
    // The new holder paid in spring for a membership first sold in fall. It is a
    // spring membership: that is the payment which put this person on site, and
    // it keeps the counts consistent with the payment rows above.
    const p = aggregate(
      [
        row({ payment_intent_id: "pi_original", paid_at: "2025-11-20T09:00:00Z" }),
        row({ payment_intent_id: "pi_acquired", paid_at: "2026-06-20T09:00:00Z" }),
      ],
      { memberships: [{ paymentIntentId: "pi_acquired", checkedIn: true }] },
    );
    expect(p.fall.memberships).toBe(0);
    expect(p.spring.memberships).toBe(1);
    expect(p.spring.checkedIn).toBe(1);
  });

  it("ignores payments belonging to another burn entirely", () => {
    const p = aggregate([
      row({ paid_at: "2026-03-01T09:00:00Z", amount_total: 222_200 }),
      row({ paid_at: "2026-03-02T09:00:00Z", amount_total: 1_000, project_id: null }),
      row({ paid_at: "2026-03-03T09:00:00Z", amount_total: 3_000, project_id: "other" }),
    ]);
    expect(p.total.operatingIncome).toBe(222_200);
    expect(p.total.payments).toBe(1);
  });

  it("counts carer memberships in the total but in neither sale", () => {
    const p = aggregate([row({ payment_intent_id: "pi_known" })], {
      memberships: [
        { paymentIntentId: "pi_known", checkedIn: false },
        { paymentIntentId: null, checkedIn: true },
        { paymentIntentId: "pi_not_in_mirror", checkedIn: false },
      ],
    });
    expect(p.fall.memberships).toBe(0);
    expect(p.spring.memberships).toBe(1);
    expect(p.total.memberships).toBe(3); // 1 payment-backed + 2 carers
    expect(p.total.checkedIn).toBe(1); // the carer who checked in
    expect(p.carerMemberships).toBe(2);
  });

  it("builds the Alversjö invoice from spring memberships and both sales' fees", () => {
    const p = aggregate([
      // fall: one addon, no refund
      row({
        paid_at: "2025-11-20T09:00:00Z",
        amount_total: 282_200,
        has_alversjo: true,
        fee: 4_413,
      }),
      // spring: two addons, one of them refunded in full
      row({
        paid_at: "2026-03-01T09:00:00Z",
        amount_total: 282_200,
        has_alversjo: true,
        fee: 4_413,
      }),
      row({
        paid_at: "2026-03-02T09:00:00Z",
        amount_total: 282_200,
        has_alversjo: true,
        fee: 4_413,
        refunds: [{ amount: 60_000 }],
      }),
    ]);
    const inv = p.alversjoInvoice;
    expect(inv.unitPriceExclVat).toBe(48_000); // 60000 / 1.25
    expect(inv.quantity).toBe(2); // spring only
    expect(inv.refundedUnits).toBeCloseTo(1, 4);
    // fees: 938 per payment (4413 * 60000/282200), three payments
    expect(inv.feesInclVat).toBe(938 * 3);
    expect(inv.totalInclVat).toBe(60_000 * 1 - 938 * 3);
  });

  it("subtracts chargebacks after income rather than inside it", () => {
    const p = aggregate([
      row({
        paid_at: "2026-03-01T09:00:00Z",
        amount_total: 222_200,
        fee: 3_513,
        disputed_amount: 222_200,
        dispute_fee: 20_000,
      }),
    ]);
    expect(p.spring.operatingIncome).toBe(222_200);
    expect(p.spring.stripeFees).toBe(3_513);
    expect(p.spring.chargebacks).toBe(242_200);
    expect(p.spring.netKept).toBe(222_200 - 3_513 - 242_200);
  });

  it("returns zeros for an empty mirror", () => {
    const p = aggregate([], { lastSyncedAt: null });
    expect(p.total.operatingIncome).toBe(0);
    expect(p.total.payments).toBe(0);
    expect(p.lastSyncedAt).toBeNull();
  });
});
