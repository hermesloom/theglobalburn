"use client";

import React from "react";
import { useProject } from "@/app/_components/SessionContext";
import { formatMoney } from "@/app/_components/utils";
import { formatDate } from "@/app/burn/[slug]/membership/components/helpers/date";

export default function TransferMembershipInstructions({
  alreadyInitiated,
}: {
  alreadyInitiated?: boolean;
}) {
  const { project } = useProject();

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
          The buyer has NOT receive an email — they just reload their membership
          page, and the purchase option will appear.
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
        <b>Before 2025-06-25 23:59 (Swedish time)</b>, you'll receive the full
        amount minus fees (
        {formatMoney(
          project!.membership!.price,
          project!.membership!.price_currency,
        )}{" "}
        -{" "}
        {formatMoney(
          project!.membership!.price *
            (project!.burn_config.transfer_fee_percentage / 100),
          project!.membership!.price_currency,
        )}{" "}
        ={" "}
        {formatMoney(
          project!.membership!.price -
            project!.membership!.price *
              (project!.burn_config.transfer_fee_percentage / 100),
          project!.membership!.price_currency,
        )}
        ).
      </li>
      <li>
        After <b>2025-06-25 23:59 (Swedish time)</b>, you'll only receive{" "}
        <b>50%</b>, while the buyer still pays full price.
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
