"use client";

import React, { useState } from "react";
import { Input } from "@nextui-org/react";
import Heading from "@/app/_components/Heading";
import ActionButton from "@/app/_components/ActionButton";
import { useProject } from "@/app/_components/SessionContext";
import { apiPost } from "@/app/_components/api";
import { BurnStage } from "@/utils/types";
import toast from "react-hot-toast";
import { isEmail } from "@/app/_components/utils";
import { formatDate } from "@/app/burn/[slug]/membership/components/helpers/date";

export default function InvitePlusOne() {
  const { project, reloadProfile } = useProject();
  const [email, setEmail] = useState("");

  if (
    project?.burn_config.current_stage !== BurnStage.LotteryClosed ||
    !project.lottery_ticket?.can_invite_plus_one
  ) {
    return null;
  }

  return (
    <>
      <Heading className="mt-12">Invite a +1!</Heading>
      <div className="flex flex-col gap-4">
        <p>
          You can invite a +1 until the open sale starts at{" "}
          <b>
            {formatDate(
              project.burn_config.open_sale_lottery_entrants_only_starting_at,
            )}
          </b>
          . The recipient must be registered on this platform. Once you have
          invited a +1, they will have{" "}
          {project.burn_config.plus_one_reservation_duration / (60 * 60)} hours
          to purchase a membership. Note that they will NOT receive any email
          after the transfer. Instead, they need to simply reload their
          membership page in their browser and will then get the opportunity to
          purchase.
        </p>
        <Input
          label="Email address of the intended recipient"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <ActionButton
          color="primary"
          isDisabled={!isEmail(email)}
          action={{
            key: "invite-plus-one",
            label: "Invite",
            onClick: async () => {
              await apiPost(`/burn/${project?.slug}/invite-plus-one`, {
                email,
              });
              await reloadProfile();
              toast.success("Invite sent!");
            },
          }}
        />
      </div>
    </>
  );
}
