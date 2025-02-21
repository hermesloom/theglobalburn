"use client";

import React, { useState } from "react";
import { apiPost } from "@/app/_components/api";
import { useProject } from "@/app/_components/SessionContext";
import MemberDetailsInput from "./helpers/MemberDetailsInput";
import { MemberDetailsData } from "./helpers/MemberDetails";
import ActionButton from "@/app/_components/ActionButton";
import toast from "react-hot-toast";
import { validateBurnAge } from "@/app/_components/utils";

export default function LotteryOpenNotEntered() {
  const { project, updateProjectSimple } = useProject();
  const [memberDetails, setMemberDetails] = useState<MemberDetailsData | null>(
    null,
  );

  return (
    <>
      <p className="mb-4">
        To enter the membership lottery, input your name and birthdate,{" "}
        <b>exactly like on your official documents</b>.
      </p>
      <div className="flex flex-col gap-4">
        <MemberDetailsInput
          value={memberDetails}
          setValue={setMemberDetails}
          ageValidation={validateBurnAge}
          withLowIncome
          withLowIncomePrompt
        />
        <ActionButton
          color="primary"
          isDisabled={!memberDetails}
          action={{
            key: "enter-lottery",
            label: "Enter the membership lottery!",
            onClick: async () => {
              const ticket = await apiPost(
                `/burn/${project?.slug}/lottery-ticket`,
                memberDetails,
              );
              updateProjectSimple({
                lottery_ticket: ticket,
              });
              toast.success("You have successfully entered the lottery!");
            },
          }}
        />
      </div>
    </>
  );
}
