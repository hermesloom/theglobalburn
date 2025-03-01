"use client";

import React, { useState } from "react";
import { Input } from "@nextui-org/react";
import Heading from "@/app/_components/Heading";
import ActionButton from "@/app/_components/ActionButton";
import { useProject } from "@/app/_components/SessionContext";
import { apiPost } from "@/app/_components/api";
import toast from "react-hot-toast";
import { isEmail } from "@/app/_components/utils";
import { formatMoney } from "@/app/_components/utils";
import { usePrompt } from "@/app/_components/PromptContext";
import { formatDate } from "@/app/burn/[slug]/membership/components/helpers/date";

export default function ReturnMembership() {
  const { project, reloadProfile } = useProject();
  const [confirmReturn, setConfirmReturn] = useState("");
  const prompt = usePrompt();

  if (
    +new Date() > +new Date(project?.burn_config.last_possible_transfer_at!)
  ) {
    return (
      <>
        <Heading className="mt-12">Return your membership</Heading>
        <p>
          The transfer window is not open and you can not return your
          membership.
        </p>
      </>
    );
  }

  return (
    <>
      <Heading className="mt-12">Return your membership</Heading>
      <div className="flex flex-col gap-4">
        <p>
          You can return your membership until{" "}
          <b>{formatDate(project?.burn_config.last_possible_transfer_at!)}</b>.
          Once you have clicked on "Return", the amount you paid (
          {formatMoney(
            project!.membership!.price,
            project!.membership!.price_currency,
          )}
          ) will be automatically refunded onto the credit card you used to
          purchase your membership. Please notify the membership team through
          the email address mentioned below in case you don't receive the refund
          within 10 days.
        </p>
        <p>
          The membership relinquished will be released to the public in the open
          sale. Any +1 memberships will remain in force.
        </p>

        <Input
          label="Type in exactly: I WANT TO RETURN MY MEMBERSHIP"
          value={confirmReturn}
          onChange={(e) => setConfirmReturn(e.target.value)}
        />
        <ActionButton
          color="primary"
          isDisabled={confirmReturn !== "I WANT TO RETURN MY MEMBERSHIP"}
          action={{
            key: "return-membership",
            label: "Return membership",
            onClick: {
              prompt: () =>
                prompt(
                  "You are about to return your membership. This can not be undone! Are you absolutely sure?",
                  [
                    {
                      key: "confirmReturn",
                      label:
                        "Type in exactly again: I WANT TO RETURN MY MEMBERSHIP",
                      validate: (finalConfirm) =>
                        finalConfirm == "I WANT TO RETURN MY MEMBERSHIP",
                    },
                  ],
                ),
              handler: async (_, promptData) => {
                await apiPost(`/burn/${project?.slug}/return-membership`, {});
                await reloadProfile();
                toast.success("Membership successfully returned!");
                return true;
              },
            },
            /*a
             */
          }}
        />
      </div>
    </>
  );
}
