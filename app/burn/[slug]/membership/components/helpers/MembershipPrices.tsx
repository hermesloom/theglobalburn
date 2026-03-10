"use client";

import React from "react";
import { useProject } from "@/app/_components/SessionContext";
import { formatMoney } from "@/app/_components/utils";

export default function MembershipPrices() {
  const { project } = useProject();
  const config = project?.burn_config;
  if (!config) return null;

  return (
    <div>
      <p>The prices are:</p>
      <ul className="list-disc pl-6">
        <li>
          High:{" "}
          {formatMoney(
            config.membership_price_tier_3,
            config.membership_price_currency,
          )}
        </li>
        <li>
          Standard:{" "}
          {formatMoney(
            config.membership_price_tier_2,
            config.membership_price_currency,
          )}
        </li>
        <li>
          Low:{" "}
          {formatMoney(
            config.membership_price_tier_1,
            config.membership_price_currency,
          )}
        </li>
      </ul>
    </div>
  );
}
