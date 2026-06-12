"use client";

import React, { useEffect, useState, useRef } from "react";
import { Spinner } from "@nextui-org/react";
import { useProject } from "@/app/_components/SessionContext";
import { BurnStage } from "@/utils/types";
import { apiGet } from "@/app/_components/api";
import ActionButton from "@/app/_components/ActionButton";
import toast from "react-hot-toast";
import { apiPost } from "@/app/_components/api";
import MembershipPrices from "@/app/burn/[slug]/membership/components/helpers/MembershipPrices";
import Heading from "@/app/_components/Heading";
import { formatDate } from "@/app/burn/[slug]/membership/components/helpers/date";

export default function OpenSale() {
  const { project, reloadProfile } = useProject();
  const lowIncomeLimit = Math.round(
    ((project?.burn_config.max_memberships ?? 0) *
      (project?.burn_config.share_memberships_low_income ?? 0)) /
    100,
  );
  const initialRender = useRef(true);
  const [isLoading, setIsLoading] = useState(false);
  const [availableMemberships, setAvailableMemberships] = useState(0);

  const updateAvailableMemberships = async () => {
    setIsLoading(true);
    const { availableMemberships } = await apiGet(
      `/burn/${project?.slug}/available-memberships`,
    );
    setAvailableMemberships(availableMemberships);
    setIsLoading(false);
  };

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      updateAvailableMemberships();
    }
  }, []);

  if (isLoading) {
    return <Spinner />;
  }

  return (
    <div className="flex flex-col gap-4">
      <p>
        There are currently{" "}
        <b>{availableMemberships < 0 ? 0 : availableMemberships}</b> memberships
        available.
      </p>
      <div className="flex flex-col gap-2">
        <ActionButton
          action={{
            key: "update-available-memberships",
            label: "Update",
            onClick: updateAvailableMemberships,
          }}
        />
        {availableMemberships > 0 ? (
          <ActionButton
            color="primary"
            action={{
              key: "reserve-membership",
              label: "Reserve my membership",
              onClick: async () => {
                await apiPost(`/burn/${project?.slug}/reserve-membership`);
                await reloadProfile();
                toast.success("Membership reserved!");
              },
            }}
          />
        ) : null}
      </div>

      {project?.burn_config.current_stage !== BurnStage.OpenSaleNonTransferable && (
        <>
          <p>
            You can still receive a membership through transfer. See the timeline
            in the panel to the left for the two transfer deadlines.
          </p>

          <MembershipPrices />

          <Heading className="mt-4">Transfers and low/high income memberships</Heading>
          <div className="flex flex-col gap-4">
            <p>
              If someone wants to transfer their membership to you, your price
              does not depend on what they originally paid.
            </p>
            <p>
              You will always have the option to pay the standard or high income
              price. If you have been approved for a low income membership and we
              currently have less than {lowIncomeLimit} low income memberships,
              you will also see that option.
            </p>
            <p>How much the seller will be refunded does not depend on what you pay.</p>
          </div>

          <Heading className="mt-4">Transfer process</Heading>
          <p>If someone wants to transfer a membership to you, the process is:</p>
          <ol className="list-decimal ml-8 flex flex-col gap-2">
            <li>You give them the email address you are currently signed in with.</li>
            <li>They sign in to the membership platform and follow the steps.</li>
            <li>
              You now have{" "}
              {(project?.burn_config.transfer_reservation_duration ?? 86400) /
                (60 * 60)}{" "}
              hours to complete the transfer. If you don&apos;t, the membership
              will return to the seller.
            </li>
            <li>
              If you do not see the option to buy a membership, please refresh
              the page.
            </li>
            <li>Buy your membership &ndash; congratulations, you are now a member!</li>
          </ol>
          <p>
            Please note, that the membership transfer has to be completed before
            the last transfer deadline{" "}
            <b>{formatDate(project?.burn_config.last_possible_transfer_at!)}</b>.
            After the deadline, there will be no transfers for any reason.
          </p>
        </>
      )}
    </div>
  );
}
