"use client";

import React from "react";
import { useProject } from "@/app/_components/SessionContext";
import { formatMoney } from "@/app/_components/utils";

export default function TransferMembershipInstructions({
  alreadyInitiated,
}: {
  alreadyInitiated?: boolean;
}) {
  const { project } = useProject();

  return (
    <ol className="list-decimal ml-8">
      {alreadyInitiated ? null : (
        <li>The intended buyer must be registered on this platform.</li>
      )}
      {alreadyInitiated ? null : (
        <li>
          Enter the email address with which the buyer is registered here below,
          type in the confirmation messages and click on 'Initiate transfer'.
        </li>
      )}
      {alreadyInitiated ? (
        <li>
          The buyer has NOT received an email, instead they simply need to
          reload their membership page and the option to purchase the membership
          will pop up.
        </li>
      ) : (
        <li>
          The buyer will NOT receive an email, instead they simply need to
          reload their membership page and the option to purchase the membership
          will pop up.
        </li>
      )}
      <li>
        Once the buyer has paid for the membership through the platform, your
        membership will be invalidated and the amount you paid will be
        automatically refunded onto the credit card you used to purchase your
        membership, <b>minus a payment processing fee</b> (i.e. you will receive
        back{" "}
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
        <b>
          {formatMoney(
            project!.membership!.price -
              project!.membership!.price *
                (project!.burn_config.transfer_fee_percentage / 100),
            project!.membership!.price_currency,
          )}
        </b>
        ). You therefore don't need to exchange any money with the recipient.
        Please notify the membership team through the email address mentioned
        below in case you don't receive the refund within 10 days.
      </li>
      <li>
        If the buyer does not purchase the membership within{" "}
        {project?.burn_config.transfer_reservation_duration! / (60 * 60)} hours
        of you initiating the transfer, you will keep your membership and it'll
        be like nothing ever happened.
      </li>
    </ol>
  );
}
