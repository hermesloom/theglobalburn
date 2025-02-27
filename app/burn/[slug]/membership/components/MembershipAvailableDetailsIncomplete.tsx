"use client";

import React, { useState } from "react";
import { useProject } from "@/app/_components/SessionContext";
import MemberDetailsInput from "./helpers/MemberDetailsInput";
import { MemberDetailsData } from "./helpers/MemberDetails";
import { apiPatch } from "@/app/_components/api";
import ActionButton from "@/app/_components/ActionButton";
import { validateBurnAge } from "@/app/_components/utils";
import { formatDate } from "@/app/burn/[slug]/membership/components/helpers/date";

export default function MembershipAvailableDetailsIncomplete() {
  const { project, reloadProfile } = useProject();
  const [memberDetails, setMemberDetails] = useState<MemberDetailsData | null>(
    null,
  );

  return (
    <div className="flex flex-col gap-4">
      <p>There is a membership available for you to purchase!</p>
      <p>
        Your membership is reserved for you until{" "}
        <b>{formatDate(project?.membership_purchase_right?.expires_at!)}</b>. If
        you don't complete the purchase of your membership by then, it will be
        released to the public in the open sale.
      </p>
      <p>
        To get started, please first complete the following details,{" "}
        <b>exactly like on your official documents</b>. You will not be able to
        change these details later.
      </p>
      <MemberDetailsInput
        value={memberDetails}
        setValue={setMemberDetails}
        ageValidation={validateBurnAge}
      />
      <ActionButton
        color="primary"
        isDisabled={!memberDetails}
        action={{
          key: "submit",
          label: "Submit",
          onClick: async () => {
            await apiPatch(
              `/burn/${project?.slug}/set-membership-purchase-right-details`,
              memberDetails,
            );
            await reloadProfile();
          },
        }}
      />
    </div>
  );
}
