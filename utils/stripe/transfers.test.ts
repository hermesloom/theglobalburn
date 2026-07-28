import { describe, expect, it } from "vitest";
import { transferRefundAmount } from "@/utils/stripe/transfers";

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
