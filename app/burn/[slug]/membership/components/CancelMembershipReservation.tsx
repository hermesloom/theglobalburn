"use client";

import React from "react";
import { Button } from "@nextui-org/react";
import { useProject } from "@/app/_components/SessionContext";
import { apiPost } from "@/app/_components/api";
import { usePrompt } from "@/app/_components/PromptContext";
import toast from "react-hot-toast";

export default function CancelMembershipReservation() {
  const { project, reloadProfile } = useProject();
  const prompt = usePrompt();

  if (!project?.membership_purchase_right) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 mt-4">
      <Button
        color="danger"
        variant="flat"
        className="whitespace-normal py-2.5 h-auto"
        onPress={async () => {
          const result = await prompt(
            "Are you sure you want to cancel your membership reservation?",
          );

          if (result) {
            try {
              await apiPost(`/burn/${project?.slug}/remove-purchase-right`, {});
              await reloadProfile();
              toast.success("Membership reservation cancelled");
            } catch (error: any) {
              toast.error(error?.message || "Failed to cancel reservation");
            }
          }
        }}
      >
        Cancel membership reservation
      </Button>
    </div>
  );
}
