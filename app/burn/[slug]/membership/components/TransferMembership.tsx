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

export default function TransferMembership() {
  const { project, reloadProfile } = useProject();
  const [email, setEmail] = useState("");
  const [confirmTransfer, setTransfer] = useState("");
  const prompt = usePrompt();
  
  if (
    +new Date() > +new Date(project?.burn_config.last_possible_transfer_at!)
  ) {
     return (<>
        
        <Heading className="mt-12">Transfer your membership</Heading>
        <p>The transfer window is not open and you can not transfer your membership.</p>
        
        </>)
  }

  return (
    <>
      <Heading className="mt-12">Transfer your membership</Heading>
      <div className="flex flex-col gap-4">
        <p>
          You can transfer your membership until{" "}
          <b>
            {new Date(
              project?.burn_config.last_possible_transfer_at!
            ).toLocaleString()}
          </b>
          . The recipient must be registered on this platform. Once you have
          entered their email address and clicked on "Transfer", the amount you
          paid (
          {formatMoney(
            project!.membership!.price,
            project!.membership!.price_currency
          )}
          ) will be automatically refunded onto the credit card you used to
          purchase your membership; you therefore don't need to exchange any
          money with the recipient. Please notify the membership team through
          the email address mentioned below in case you don't receive the refund
          within 10 days.
        </p>
        <p>
          The recipient must purchase the membership within{" "}
          {project?.burn_config.transfer_reservation_duration! / (60 * 60 * 24)}{" "}
          days after the transfer, otherwise it will be released to the public
          in the open sale.
        </p>
        {project?.membership?.price ===
        project?.burn_config.membership_price_tier_1 ? (
          <p>
            Even though you had won a low-income membership, the recipient
            cannot make use of the low-income price for their membership.
          </p>
        ) : null}
        <Input
          label="Email address of the intended recipient"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
         <Input
          label="Type in exactly: I WANT TO TRANSFER"
          value={confirmTransfer}
          onChange={(e) => setTransfer(e.target.value)}
        />
        
        <ActionButton
          color="primary"
          isDisabled={!isEmail(email) && confirmTransfer!="I WANT TO TRANSFER"}
          action={{
            key: "transfer-membership",
            label: "Transfer",
            onClick: {
              prompt: () =>
                prompt("You are about to return your membership. This can not be undone! Are you absolutely sure?", [
                  {
                    key: "confirmReturn",
                    label: "Type in one more time: I WANT TO TRANSFER",
                    validate: (finalConfirm) => finalConfirm=="I WANT TO TRANSFER",
                  }
                ]),
              handler: async (_, promptData) => {
                await apiPost(`/burn/${project?.slug}/transfer-membership`, {
                  email, confirmTransfer,
                });
                await reloadProfile();
                toast.success("Membership successfully transfered!");
                return true;
              },
            },
           
          }}
        />
      </div>
    </>
  );
}
