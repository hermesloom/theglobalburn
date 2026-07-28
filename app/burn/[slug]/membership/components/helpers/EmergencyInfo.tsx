import React, { useState, useEffect } from "react";
import Heading from "@/app/_components/Heading";
import { usePrompt } from "@/app/_components/PromptContext";
import ActionButton from "@/app/_components/ActionButton";
import { apiPatch } from "@/app/_components/api";
import { useProject } from "@/app/_components/SessionContext";
import { phonePromptField } from "@/utils/phone";
import { linkifyPhoneNumbers } from "@/utils/phoneLinks";

export interface EmergencyInfoData {
  phone_number?: string;
  emergency_contact_onsite?: string;
  emergency_contact_other?: string;
  camp_name?: string;
}

export default function EmergencyInfo({ data }: { data: EmergencyInfoData }) {
  const [info, setInfo] = useState(data);
  const { project, refreshProfile } = useProject();
  const prompt = usePrompt();

  useEffect(() => { setInfo(data); }, [data]);

  const updateInfo = async (newInfo: EmergencyInfoData) => {
    await apiPatch(`/burn/${project!.slug}/emergency_info`, newInfo);
    setInfo(newInfo);
    refreshProfile();
  };

  console.log('info');
  console.log(info);
  const hasAnyValue =
    info.phone_number ||
    info.emergency_contact_onsite ||
    info.emergency_contact_other ||
    info.camp_name;

  return (
    <>
      <Heading className="mt-12">Emergency &amp; contact information</Heading>
      <p className="text-sm text-default-500 mb-4">
        Optional. Helps event staff assist you or contact someone on your behalf
        in case of emergency.
      </p>
      {hasAnyValue && (
        <div className="flex flex-col gap-1 mb-4">
          {info.phone_number && (
            <p>
              <strong>Phone Number:</strong> {info.phone_number}
            </p>
          )}
          {info.camp_name && (
            <p>
              <strong>Camp Name:</strong> {info.camp_name}
            </p>
          )}
          {info.emergency_contact_onsite && (
            <p>
              <strong>Emergency Contact (On-Site):</strong>{" "}
              {linkifyPhoneNumbers(info.emergency_contact_onsite)}
            </p>
          )}
          {info.emergency_contact_other && (
            <p>
              <strong>Emergency Contact (Other):</strong>{" "}
              {linkifyPhoneNumbers(info.emergency_contact_other)}
            </p>
          )}
        </div>
      )}
      <ActionButton
        action={{
          key: "editEmergencyInfo",
          label: hasAnyValue ? "Edit emergency info" : "Add emergency info",
          onClick: {
            prompt: () =>
              prompt(
                "Optional — helps event staff contact you or someone on your behalf in an emergency.",
                [
                  phonePromptField("phone_number", "Phone Number", info.phone_number ?? ""),
                  {
                    key: "camp_name",
                    label: "Camp Name",
                    defaultValue: info.camp_name ?? "",
                    canBeEmpty: true,
                  },
                  {
                    key: "emergency_contacts_header",
                    label: "Emergency Contacts",
                    type: "header" as const,
                    canBeEmpty: true,
                  },
                  {
                    key: "emergency_contact_onsite",
                    label: "On-Site (Name, Phone, and/or Camp)",
                    defaultValue: info.emergency_contact_onsite ?? "",
                    canBeEmpty: true,
                  },
                  {
                    key: "emergency_contact_other",
                    label: "Other (Name + Phone)",
                    defaultValue: info.emergency_contact_other ?? "",
                    canBeEmpty: true,
                  },
                ],
              ),
            handler: async (_, promptData) => {
              await updateInfo(promptData as EmergencyInfoData);
            },
          },
        }}
      />
    </>
  );
}
