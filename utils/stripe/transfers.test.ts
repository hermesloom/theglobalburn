import { describe, expect, it } from "vitest";
import {
  buildRefundFailureEmail,
  REFUND_FAILURE_ALERT_EMAIL,
  transferRefundAmount,
} from "@/utils/stripe/transfers";

describe("transferRefundAmount", () => {
  it("keeps the transfer fee on a normal membership", () => {
    // 2222 SEK, 3% fee
    expect(transferRefundAmount(222_200, 3)).toBe(215_534);
    // 2222 SEK, 50% fee
    expect(transferRefundAmount(222_200, 50)).toBe(111_100);
  });

  it("bases the refund on what is still refundable, not the original price", () => {
    // The real failure: paid 2822, 600 of it already refunded as an Alversjö
    // cancellation, so only 2222 remains. The old code computed 2822 * 0.97 =
    // 2737.34, which exceeds the refundable balance and Stripe rejects.
    expect(transferRefundAmount(222_200, 3)).toBe(215_534);
    expect(transferRefundAmount(282_200, 3)).toBe(273_734);
  });

  it("never exceeds what is still refundable", () => {
    for (const fee of [0, 3, 50, 100]) {
      expect(transferRefundAmount(222_200, fee)).toBeLessThanOrEqual(222_200);
    }
  });

  it("returns nothing when the payment is already fully refunded", () => {
    expect(transferRefundAmount(0, 3)).toBe(0);
    expect(transferRefundAmount(-100, 3)).toBe(0);
  });

  it("refunds everything at a zero fee and nothing at a hundred percent", () => {
    expect(transferRefundAmount(222_200, 0)).toBe(222_200);
    expect(transferRefundAmount(222_200, 100)).toBe(0);
  });

  it("clamps a nonsensical fee rather than paying out more than was held", () => {
    expect(transferRefundAmount(222_200, -10)).toBe(222_200);
    expect(transferRefundAmount(222_200, 150)).toBe(0);
  });

  it("rounds to whole minor units", () => {
    expect(Number.isInteger(transferRefundAmount(123_401, 3))).toBe(true);
  });
});

describe("buildRefundFailureEmail", () => {
  const base = {
    projectName: "The Borderland 2026",
    memberName: "Ida Björses",
    memberEmail: "ida@example.com",
    membershipId: "e2c9f1ce-de6f-406a-819a-afef7351aadb",
    paymentIntentId: "pi_3T9THOEuBjGnolU21apcAVYQ",
    intendedAmount: 2155.34,
    currency: "SEK",
    error: "Refund amount exceeds the remaining charge amount.",
  };

  it("names the burn and the member in the subject", () => {
    const { subject } = buildRefundFailureEmail(base);
    expect(subject).toContain("The Borderland 2026");
    expect(subject).toContain("Ida Björses");
    expect(subject).toContain("FAILED");
  });

  it("carries everything needed to refund by hand", () => {
    const { text } = buildRefundFailureEmail(base);
    expect(text).toContain("ida@example.com");
    expect(text).toContain("2155.34 SEK");
    expect(text).toContain("pi_3T9THOEuBjGnolU21apcAVYQ");
    expect(text).toContain(base.membershipId);
    expect(text).toContain("Refund amount exceeds the remaining charge amount.");
  });

  it("says plainly that the member has lost their membership and not been paid", () => {
    const { text } = buildRefundFailureEmail(base);
    expect(text).toContain("NOT been paid");
  });

  it("copes with a member whose email or amount is unknown", () => {
    const { text } = buildRefundFailureEmail({
      ...base,
      memberEmail: null,
      intendedAmount: null,
      paymentIntentId: null,
    });
    expect(text).toContain("unknown");
    expect(text).toContain("none recorded");
  });

  it("alerts tech@theborderland.se", () => {
    expect(REFUND_FAILURE_ALERT_EMAIL).toBe("tech@theborderland.se");
  });
});
