"use client";

import React, { useEffect } from "react";
import { useProject } from "@/app/_components/SessionContext";
import MemberDetailsWithHeading from "./helpers/MemberDetailsWithHeading";
import InvitePlusOne from "./InvitePlusOne";
import { QRCodeSVG } from "qrcode.react";
import { useSearchParams, useRouter } from "next/navigation";
import TransferMembership from "./TransferMembership";
import ReturnMembership from "./ReturnMembership";
import ListOfChildren from "./helpers/ListOfChildren";

export default function Member() {
  const { project } = useProject();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      const url = new URL(window.location.href);
      url.searchParams.delete("success");
      router.replace(url.pathname + url.search);
    }
  }, [searchParams, router]);

  return (
    <>
      <div className="flex flex-col gap-4">
        <p>
          Congratulations, you have successfully purchased a membership for{" "}
          {project?.name}! 🎉 This is your QR code.
        </p>
        <div className="border border-gray-200 rounded-lg p-4 w-fit">
          <QRCodeSVG value={project?.membership!.id!} />
        </div>
      </div>
      <InvitePlusOne />
      <MemberDetailsWithHeading data={project?.membership!} />
      <ListOfChildren data={project?.membership!.metadata?.children || []} />

      <TransferMembership />
      <ReturnMembership />
    </>
  );
}
