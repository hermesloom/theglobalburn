"use client";

import React from "react";
import TransferMembershipInstructions from "./TransferMembershipInstructions";

export default function MembershipBeingTransferred() {
  return (
    <div className="flex flex-col gap-4">
      <p>
        Your existing membership is currently being transferred to another
        person. This is how it works now:
      </p>
      <TransferMembershipInstructions alreadyInitiated />
    </div>
  );
}
