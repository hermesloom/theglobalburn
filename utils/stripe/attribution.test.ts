import { describe, expect, it } from "vitest";
import { classifySale, splitPayment } from "@/utils/stripe/attribution";
import { MembershipPaymentRow } from "@/utils/stripe/types";

const EVENT_END = new Date("2026-07-26T12:00:00Z"); // The Borderland 2026
const ALVERSJO = 60_000; // 600 SEK in öre

function row(over: Partial<MembershipPaymentRow> = {}): MembershipPaymentRow {
  return {
    session_id: "cs_live_test",
    payment_intent_id: "pi_test",
    paid_at: "2026-03-15T12:00:00Z",
    project_id: "06101baf-5991-42b1-b2f5-caa9fd6b90e2",
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

  it("nets fee refunds and dispute fees into the fee", () => {
    const s = splitPayment(
      row({ fee: 3_513, fee_refunded: -1_200, dispute_fee: 20_000 }),
      ALVERSJO,
    );
    expect(s.netFee).toBe(3_513 - 1_200 + 20_000);
  });

  it("deducts disputed amounts from net income", () => {
    // Real case: the one disputed 2222 SEK charge
    const s = splitPayment(row({ disputed_amount: 222_200 }), ALVERSJO);
    expect(s.baseNet).toBe(0);
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
    // first is addon-sized -> all Alversjö; second splits proportionally
    expect(s.alversjoRefunded).toBe(
      60_000 + Math.round((111_100 * 60_000) / 282_200),
    );
    expect(s.baseRefunded + s.alversjoRefunded).toBe(171_100);
  });

  it("does not divide by zero on a zero-amount payment", () => {
    const s = splitPayment(row({ amount_total: 0, fee: 0 }), ALVERSJO);
    expect(s.baseNet).toBe(0);
    expect(s.alversjoNet).toBe(0);
  });
});
