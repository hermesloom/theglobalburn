"use client";

import React, { useState } from "react";
import { Input } from "@nextui-org/react";
import Heading from "@/app/_components/Heading";
import ActionButton from "@/app/_components/ActionButton";
import { useProject } from "@/app/_components/SessionContext";
import { apiPost } from "@/app/_components/api";
import toast from "react-hot-toast";
import { isEmail } from "@/app/_components/utils";
import { usePrompt } from "@/app/_components/PromptContext";
import TransferMembershipInstructions from "./TransferMembershipInstructions";

export default function TransferMembership() {
  const { project, reloadProfile } = useProject();
  const [email, setEmail] = useState("");
  const [confirmTransfer, setTransfer] = useState("");
  const prompt = usePrompt();

  if (
    +new Date() > +new Date(project?.burn_config.last_possible_transfer_at!)
  ) {
    return (
      <>
        <Heading className="mt-12">Transfer your membership</Heading>

        <p>
          The transfer window is not open and you can not transfer your
          membership.
        </p>
      </>
    );
  }

  return (
    <>
      <Heading className="mt-12">Transfer your membership</Heading>
      <div className="flex flex-col gap-4">
        <p>If you want to transfer your membership, this is how it works:</p>
        <TransferMembershipInstructions />
        <Input
          label="Email address of the intended recipient"
          value={email}
          onChange={(e) => setEmail(e.target.value.replace(/\s/g, ""))}
        />
        <Input
          label="Type in exactly: I WANT TO TRANSFER MY MEMBERSHIP"
          value={confirmTransfer}
          onChange={(e) => setTransfer(e.target.value)}
        />

        <ActionButton
          color="primary"
          isDisabled={
            !isEmail(email) ||
            confirmTransfer !== "I WANT TO TRANSFER MY MEMBERSHIP"
          }
          action={{
            key: "transfer-membership",
            label: "Initiate transfer",
            onClick: {
              prompt: () =>
                prompt(
                  `You are about to transfer your membership to ${email}. This cannot be undone! Are you absolutely sure?`,
                  [
                    {
                      key: "confirmReturn",
                      label:
                        "Type in one more time: I WANT TO TRANSFER MY MEMBERSHIP",
                      validate: (finalConfirm) =>
                        finalConfirm == "I WANT TO TRANSFER MY MEMBERSHIP",
                    },
                  ],
                ),
              handler: async (_, promptData) => {
                await apiPost(`/burn/${project?.slug}/transfer-membership`, {
                  email,
                });
                await reloadProfile();
                toast.success("Membership transfer successfully initiated!");
                return true;
              },
            },
          }}
        />
      </div>
    </>
  );
}
