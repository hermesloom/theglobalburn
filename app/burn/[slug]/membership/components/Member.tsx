"use client";

import React, { useEffect, useState } from "react";
import { Link } from "@nextui-org/link";
import { useProject } from "@/app/_components/SessionContext";
import MemberDetails from "./helpers/MemberDetails";
import InvitePlusOne from "./InvitePlusOne";
import { QRCodeSVG } from "qrcode.react";
import { useSearchParams, useRouter } from "next/navigation";
import TransferMembership from "./TransferMembership";
import ListOfChildren from "./helpers/ListOfChildren";
import ListOfPets from "./helpers/ListOfPets";
import EmergencyInfo from "./helpers/EmergencyInfo";
import CarRegistration from "./helpers/CarRegistration";

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

  const [qrExpanded, setQrExpanded] = useState(false);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div>
          <div className="flex flex-col gap-4">
            <p>
              Congratulations, you now have a{" "}
              {project?.membership?.is_non_transferable ? (
                <b>non-transferable</b>
              ) : (
                ""
              )}{" "}
              membership for {project?.name}! 🎉 This is your QR code. Please have
              this code (with a <b>physical ID</b>) ready to show at the gate when you enter the event.
            </p>
            <p>
              Check the <Link href={`/burn/${project?.slug}/links`}>links</Link> in
              the left pane to see how to get involved!
            </p>
            <div
              className="border border-gray-200 rounded-lg p-4 w-fit cursor-pointer"
              onClick={() => setQrExpanded(true)}
              tabIndex={0}
              title="Click to expand"
            >
              <QRCodeSVG value={project?.membership!.id!} />
            </div>
            <p className="text-sm text-default-500">Click the QR code to expand.</p>
            {qrExpanded && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-white cursor-pointer"
                onClick={() => setQrExpanded(false)}
              >
                <button className="absolute top-4 right-4 text-3xl leading-none text-gray-600 hover:text-black">✕</button>
                <QRCodeSVG value={project?.membership!.id!} size={Math.min(window.innerWidth, window.innerHeight) - 64} />
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="flex flex-col gap-4">
            <MemberDetails data={project?.membership!} />
          </div>
        </div>
      </div>
      <InvitePlusOne />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div><CarRegistration data={project?.membership!.metadata?.car_registration || {}} /></div>
        <div><EmergencyInfo data={project?.membership!.metadata?.emergency_info || {}} /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div><ListOfChildren data={project?.membership!.metadata?.children || []} /></div>
        <div><ListOfPets data={project?.membership!.metadata?.pets || []} /></div>
      </div>

      {project?.membership?.is_non_transferable ? null : <TransferMembership />}

      {/* <ReturnMembership /> <-- DO NOT REACTIVATE, RISK OF DANGEROUS BUDGET LOSS!!! */}
    </>
  );
}
