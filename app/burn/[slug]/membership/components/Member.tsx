"use client";

import React, { useEffect } from "react";
import { Link } from "@nextui-org/link";
import { useProject } from "@/app/_components/SessionContext";
import MemberDetailsWithHeading from "./helpers/MemberDetailsWithHeading";
import InvitePlusOne from "./InvitePlusOne";
import { QRCodeSVG } from "qrcode.react";
import { useSearchParams, useRouter } from "next/navigation";
import TransferMembership from "./TransferMembership";
import ReturnMembership from "./ReturnMembership";
import ListOfChildren from "./helpers/ListOfChildren";
import ListOfPets from "./helpers/ListOfPets";

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
          Congratulations, you now have a{" "}
          {project?.membership?.is_non_transferable ? (
            <b>non-transferable</b>
          ) : (
            ""
          )}{" "}
          membership for {project?.name}! 🎉 This is your QR code. Please have
          this code ready to show at the gate when you enter the event.
        </p>
        <p>
          Check the <Link href={`/burn/${project?.slug}/links`}>links</Link> in
          the left pane to see how to get involved!
        </p>
        <div className="border border-gray-200 rounded-lg p-4 w-fit">
          <QRCodeSVG value={project?.membership!.id!} />
        </div>
      </div>
      <InvitePlusOne />
      <MemberDetailsWithHeading data={project?.membership!} />

      <ListOfChildren data={project?.membership!.metadata?.children || []} />
      <ListOfPets data={project?.membership!.metadata?.pets || []} />

      {project?.membership?.is_non_transferable ? null : <TransferMembership />}

      {/* <ReturnMembership /> <-- DO NOT REACTIVATE, RISK OF DANGEROUS BUDGET LOSS!!! */}
    </>
  );
}
