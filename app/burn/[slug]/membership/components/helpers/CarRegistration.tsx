import React, { useState, useEffect } from "react";
import Heading from "@/app/_components/Heading";
import { usePrompt } from "@/app/_components/PromptContext";
import ActionButton from "@/app/_components/ActionButton";
import { Button } from "@nextui-org/react";
import { apiPatch } from "@/app/_components/api";
import { useProject } from "@/app/_components/SessionContext";
import { phonePromptField } from "@/utils/phone";
import QRCode from "qrcode";

export interface CarRegistrationData {
  phone_number?: string;
  alt_contact?: string;
  camp_or_area?: string;
  registration_plate?: string;
}

async function printPermit(
  memberName: string,
  info: CarRegistrationData,
  eventName: string,
) {
  const blank = `<span style="display:inline-block;width:100%;border-bottom:1.5px solid #000;min-width:120px">&nbsp;</span>`;
  const field = (label: string, value: string | undefined) =>
    `<div style="margin-bottom:12px"><div style="font-weight:bold;font-size:16px;color:#555">${label}</div><div style="font-size:22px;text-align:right;margin-top:10px">${value || blank}</div></div>`;

  let qrCode = "";
  if (info.phone_number) {
    const dataUrl = await QRCode.toDataURL(`tel:${info.phone_number}`, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: 'H',
    });
    qrCode = `<img src="${dataUrl}" width="200" height="200" alt="QR code" style="display:block" />
      <div style="font-size:11px;color:#555;margin-top:4px;text-align:center">scan to call</div>`;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Borderland Sleeper Vehicle Permit</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 14px; margin: 32px; color: #000; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    h2 { font-size: 15px; font-weight: bold; color: #555; margin-top: 0; margin-bottom: 4px; }
    table { border-collapse: collapse; }
    .details { border: 2px solid #000; padding: 16px 20px; margin-bottom: 32px; }
    .rules ul { margin: 6px 0; padding-left: 20px; }
    .rules ul + ul { margin-bottom: 16px; }
    .rules li { margin-bottom: 6px; }
    .mandatory li { font-weight: bold; }
    @page { margin: 0; }
    @media print { body { margin: 20mm; } }
  </style>
</head>
<body>
  <h1>${eventName} Sleeper Vehicle Permit</h1>

  <p style="font-weight: bold">PUT THIS INFORMATION IN THE MEMBERSHIP PLATFORM AT</p>
  <p style="font-weight: bold">https://members.theborderland.se</p>

  <p>Valid for vehicles a person is sleeping in. Non-sleeper vehicles must be in the long-term parking lot (outside of the event).</p>

  <div class="details" style="display:flex;align-items:flex-start;gap:24px;">
    <div style="flex:1;min-width:0">
      ${field("Name", " ")}
      ${field("Phone Number", info.phone_number)}
      ${field("Alternative Name/Phone", info.alt_contact)}
      ${field("Camp Name / Neighborhood", info.camp_or_area)}
      ${field("Registration Plate", info.registration_plate)}
    </div>
    ${qrCode ? `<div style="flex-shrink:0;width:210px">${qrCode}</div>` : ""}
  </div>
  <div class="rules">/
    <ul>
      <li>Gate closed 22:00–09:00.</li>
      <li>Only Sleeper Vehicles can enter during the burn days when the gate is open.</li>
      <li>Once a Sleeper Vehicle leaves it cannot re-enter. No grocery runs.</li>
      <li>Gate opens for exodus on Sunday, July 26, at 06:00</li>
    </ul>

    <ul>
      <li>No stopping or parking on fire roads.</li>
      <li>Speed limit: 10 km/hr</li>
    </ul>

    <ul>
      <li>No driving on site during the event.</li>
      <li>Keep this card visible at all times.</li>
    </ul>

    <ul>
      <li>
        Please also help make the Borderland even more beautiful by pimping your vehicle!
      </li>
    </ul>

    <h2>MANDATORY</h2>
    <ul class="mandatory">
      <li>4 metres fire perimeter to other structures.</li>
    </ul>
  </div>
  <script>window.onload = function() { window.print(); }; window.onafterprint = function() { window.close(); };<\/script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

export default function CarRegistration({
  data,
}: {
  data: CarRegistrationData;
}) {
  const [info, setInfo] = useState(data);
  const { project, refreshProfile } = useProject();
  const prompt = usePrompt();

  useEffect(() => { setInfo(data); }, [data]);

  const memberName = [
    project?.membership?.first_name,
    project?.membership?.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  const updateInfo = async (newInfo: CarRegistrationData) => {
    await apiPatch(`/burn/${project!.slug}/car_registration`, newInfo);
    setInfo(newInfo);
    refreshProfile();
  };

  const hasAnyValue =
    info.phone_number ||
    info.alt_contact ||
    info.camp_or_area ||
    info.registration_plate;

  return (
    <>
      <Heading className="mt-12">Sleeper Vehicle Application</Heading>

      <p className="text-sm text-default-500 mb-4">
        (All <strong>non-sleeper vehicles</strong> should have <a className="text-primary underline" href="https://docs.google.com/document/d/1OXUdZQozSgg-ugvzp-aI81bh_YjeLMk7WC84wSRPJJs/edit?tab=t.0" target="_blank">this form</a> visible at all times when parked in the long-term parking)
      </p>

      <p className="text-sm text-default-500 mb-4">
        Reducing the number of vehicles inside of event area helps preserve the vibe and increase safety. Vehicles not used for sleeping must be parked in the long-term parking lot, not inside the event area.
      </p>

      <p className="text-sm text-default-500 mb-4">
        For Borderlings who are <strong>sleeping in their car, caravan, or camper van</strong>, the following is <strong>MANDATORY</strong>.
      </p>

      <p className="text-sm text-default-500 mb-4">
        <strong>Step 1:</strong>
        {" "}Register your vehicle below.
      </p>

      <p className="text-sm text-default-500 mb-4">
        <strong>Step 2:</strong>
        {" "}Print the permit below (or fill it out at the gate) and keep it visible in your windshield/window at all times. IMPORTANT! This is how you'll be reached in an emergency involving your vehicle.
      </p>

      <p className="text-sm text-default-500 mb-4">
        <strong>Step 3:</strong>
        {" "}<a className="text-primary underline" href="https://coda.io/d/Survival-Guide_ddTvwEwgvJw/Preparing" target="_blank" rel="noopener noreferrer">Read the Survival Guide</a> - especially Preparing and Safety - for the 4-metre fire perimeter between vehicles and other structures.
      </p>

      <p className="text-sm text-default-500 mb-4">
        Please also help make the Borderland even more beautiful by pimping your vehicle! Turning your vehicle into art is a tradition, and we love it when cars, vans and caravans leave the default world behind.
      </p>

      {hasAnyValue && (
        <div className="flex flex-col gap-1 mb-4">
          <p>
            <strong>Name:</strong> {memberName}
          </p>
          {info.phone_number && (
            <p>
              <strong>Phone Number:</strong> {info.phone_number}
            </p>
          )}
          {info.alt_contact && (
            <p>
              <strong>Alternative Name/Phone:</strong> {info.alt_contact}
            </p>
          )}
          {info.camp_or_area && (
            <p>
              <strong>Camp Name / Neighborhood:</strong> {info.camp_or_area}
            </p>
          )}
          {info.registration_plate && (
            <p>
              <strong>Registration Plate:</strong> {info.registration_plate}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <ActionButton
          action={{
            key: "editCarRegistration",
            label: hasAnyValue ? "Edit sleeper vehicle registration" : "Add sleeper vehicle registration",
            onClick: {
              prompt: () =>
                prompt("Register your sleeper vehicle for the event.", [
                  {
                    key: "name",
                    label: "Name",
                    type: "textWithTopLabel" as const,
                    defaultValue: memberName,
                    readOnly: true,
                    canBeEmpty: true,
                  },
                  phonePromptField("phone_number", "Phone Number", info.phone_number ?? ""),
                  {
                    key: "alt_contact",
                    label: "Alternative Name/Phone Number",
                    defaultValue: info.alt_contact ?? "",
                    canBeEmpty: true,
                  },
                  {
                    key: "camp_or_area",
                    label: "Camp Name / Neighborhood",
                    defaultValue: info.camp_or_area ?? "",
                    canBeEmpty: true,
                  },
                  {
                    key: "registration_plate",
                    label: "Registration Plate",
                    defaultValue: info.registration_plate ?? "",
                    canBeEmpty: true,
                  },
                ]),
              handler: async (_, promptData) => {
                if (!promptData) return;
                const { name: _name, ...rest } = promptData;
                await updateInfo(rest as CarRegistrationData);
              },
            },
          }}
        />
        {hasAnyValue && (
          <Button
            onPress={async () =>
              await printPermit(memberName, info, project?.name ?? "The Borderland")
            }
          >
            Print permit
          </Button>
        )}
      </div>
    </>
  );
}
