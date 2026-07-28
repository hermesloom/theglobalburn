import { describe, expect, it } from "vitest";
import { ALVERSJO_ADDON_ID } from "@/utils/stripe/types";

describe("stripe types module", () => {
  it("exposes the Alversjö addon id used in burn_config", () => {
    expect(ALVERSJO_ADDON_ID).toBe("alversjo-membership");
  });
});
