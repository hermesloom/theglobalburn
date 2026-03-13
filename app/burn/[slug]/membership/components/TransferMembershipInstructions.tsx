"use client";

import React from "react";
import { useProject } from "@/app/_components/SessionContext";
import { formatMoney } from "@/app/_components/utils";
import { formatDate } from "@/app/burn/[slug]/membership/components/helpers/date";

/** Set to true when the main transfer window has closed and the refund is much lower than before. */
const AFTER_MAIN_TRANSFER_WINDOW = false;
/** When the main transfer window closes; after this the refund is much reduced. (ISO 8601) */
const MAIN_TRANSFER_WINDOW_CLOSES_AT = "2025-06-25T21:59:00Z";

export default function TransferMembershipInstructions({
  alreadyInitiated,
}: {
  alreadyInitiated?: boolean;
}) {
  const { project } = useProject();

  const refundAmount =
    project!.membership!.price *
    (1 - project!.burn_config.transfer_fee_percentage / 100);

  return (
    <ol className="list-decimal ml-8">
      {alreadyInitiated ? null : (
        <li>The buyer must be registered on this platform.</li>
      )}
      {alreadyInitiated ? null : (
        <li>
          Enter the email address with which the buyer is registered here below,
          type in the confirmation messages and click on 'Initiate transfer'.
        </li>
      )}
      {alreadyInitiated ? (
        <li>
          The buyer has NOT received an email — they just reload their
          membership page, and the purchase option will appear.
        </li>
      ) : (
        <li>
          The buyer will NOT receive an email — they just reload their
          membership page, and the purchase option will appear.
        </li>
      )}
      <li>
        Once the buyer pays, your membership will be invalidated and refunded
        automatically to your original payment card.
      </li>
      <li>
        {AFTER_MAIN_TRANSFER_WINDOW && (
          <>
            As the main transfer window has already closed on{" "}
            <b>{formatDate(MAIN_TRANSFER_WINDOW_CLOSES_AT)}</b>, the refund is
            now much lower.{" "}
          </>
        )}
        You will receive{" "}
        {formatMoney(refundAmount, project!.membership!.price_currency)} back
        (membership price minus {project!.burn_config.transfer_fee_percentage}%
        transfer fee).
      </li>
      <li>
        After{" "}
        <b>
          {formatDate(project?.burn_config.last_possible_transfer_at!)}, there
          will be no transfers for any reason.
        </b>
      </li>
      <li>
        If the buyer doesn't complete the purchase within{" "}
        {project?.burn_config.transfer_reservation_duration! / (60 * 60)} hours,
        your membership remains valid as if nothing happened.
      </li>
      <li>
        Please note that the transfer has to be completed before the deadline,
        so don’t attempt to do this last minute.
      </li>
    </ol>
  );
}
