"use client";

import React, { useState } from "react";
import { Button } from "@nextui-org/react";
import { useProject } from "@/app/_components/SessionContext";
import { apiGet } from "@/app/_components/api";
import toast from "react-hot-toast";
import { calculateAge } from "@/app/burn/[slug]/membership/components/helpers/date";
import DataTable from "@/app/_components/DataTable";

function arrayToCsv(data: string[][]): string {
  return data
    .map((row) =>
      row
        .map(String)
        .map((v) => v.replaceAll('"', '""'))
        .map((v) => `"${v}"`)
        .join(",")
    )
    .join("\r\n");
}

function downloadBlob(content: string, filename: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.setAttribute("download", filename);
  a.click();
}

export default function MembershipAdminPage() {
  const { project } = useProject();
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [loadingPets, setLoadingPets] = useState(false);
  const [loadingMemberInfo, setLoadingMemberInfo] = useState(false);

  const downloadChildrenCsv = async () => {
    setLoadingChildren(true);
    try {
      const result = await apiGet(
        `/burn/${project?.slug}/admin/members-with-children`
      );
      const members: Array<{
        first_name: string;
        last_name: string;
        email: string;
        children: Array<{ first_name: string; last_name: string; dob: string }>;
      }> = result.data;

      const rows: string[][] = [
        [
          "First name",
          "Last name",
          "Email",
          "Number of children",
          "Children's ages",
        ],
      ];

      for (const member of members) {
        const ages = member.children.map((child) =>
          String(calculateAge(new Date(child.dob)))
        );
        rows.push([
          member.first_name,
          member.last_name,
          member.email,
          String(member.children.length),
          ages.join(", "),
        ]);
      }

      downloadBlob(
        arrayToCsv(rows),
        "members-with-children.csv",
        "text/csv;charset=utf-8;"
      );
    } catch {
      toast.error("Failed to download CSV.");
    } finally {
      setLoadingChildren(false);
    }
  };

  const downloadMemberInfoCsv = async () => {
    setLoadingMemberInfo(true);
    try {
      const result = await apiGet(`/burn/${project?.slug}/admin/memberships`);
      const memberships: Array<{
        first_name: string;
        last_name: string;
        metadata?: { burner_questionnaire_result?: { borderland_visits?: string; previous_events?: string } };
      }> = result.data;

      const rows: string[][] = [["First name", "Last name", "Borderland visits", "Previous events"]];
      for (const m of memberships) {
        const q = m.metadata?.burner_questionnaire_result;
        rows.push([m.first_name ?? "", m.last_name ?? "", q?.borderland_visits ?? "", q?.previous_events ?? ""]);
      }
      downloadBlob(arrayToCsv(rows), "member-info.csv", "text/csv;charset=utf-8;");
    } catch {
      toast.error("Failed to download CSV.");
    } finally {
      setLoadingMemberInfo(false);
    }
  };

  const downloadPetsCsv = async () => {
    setLoadingPets(true);
    try {
      const result = await apiGet(
        `/burn/${project?.slug}/admin/members-with-pets`
      );
      const members: Array<{
        first_name: string;
        last_name: string;
        email: string;
        pets: Array<{
          name: string;
          type: string;
          chip_code: string;
          description: string;
          other_information: string;
        }>;
      }> = result.data;

      const rows: string[][] = [
        [
          "First name",
          "Last name",
          "Email",
          "Pet name",
          "Pet type",
          "Chip code",
          "Pet description",
          "Other information",
        ],
      ];

      const allRows: string[][] = [];
      for (const member of members) {
        for (const pet of member.pets) {
          allRows.push([
            member.first_name,
            member.last_name,
            member.email,
            pet.name ?? "",
            pet.type ?? "",
            pet.chip_code ?? "",
            pet.description ?? "",
            pet.other_information ?? "",
          ]);
        }
      }

      allRows.sort((a, b) => {
        const first = a[0].localeCompare(b[0]);
        return first !== 0 ? first : a[1].localeCompare(b[1]);
      });

      rows.push(...allRows);

      downloadBlob(
        arrayToCsv(rows),
        "members-with-pets.csv",
        "text/csv;charset=utf-8;"
      );
    } catch {
      toast.error("Failed to download CSV.");
    } finally {
      setLoadingPets(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold mb-6">Membership Admin</h1>
        <div className="flex gap-4">
          <Button color="primary" onPress={downloadChildrenCsv} isLoading={loadingChildren}>
            Download members with children (CSV)
          </Button>
          <Button color="primary" onPress={downloadPetsCsv} isLoading={loadingPets}>
            Download members with pets (CSV)
          </Button>
          <Button color="primary" onPress={downloadMemberInfoCsv} isLoading={loadingMemberInfo}>
            Download member info (CSV)
          </Button>
        </div>
      </div>
      <DataTable
        title="Transferred Memberships"
        endpoint={`/burn/${project?.slug}/admin/transferred-memberships`}
        sortRows={(a, b) =>
          String(a.last_name ?? "").localeCompare(String(b.last_name ?? ""))
        }
        searchBar={{
          placeholder: "Search by name, email, or transfer history…",
          fields: [
            {
              id: "all",
              label: "All",
              getValue: (row) =>
                [
                  row.first_name,
                  row.last_name,
                  row.email,
                  ...((row.transfer_history as any[]) ?? []).flatMap((step: any) => [
                    step.from_first_name,
                    step.from_last_name,
                    step.from_email,
                    step.to_email,
                  ]),
                ]
                  .filter(Boolean)
                  .join(" "),
            },
          ],
        }}
        columns={[
          { key: "first_name", label: "First name" },
          { key: "last_name", label: "Last name" },
          { key: "email", label: "Current owner email" },
          {
            key: "transfer_history",
            label: "Transfer history",
            render: (value) => {
              const history: Array<{
                created_at: string;
                from_first_name: string;
                from_last_name: string;
                from_email: string;
                to_email: string;
              }> = value ?? [];
              return (
                <div className="flex flex-col gap-1 text-sm">
                  {history.map((step, i) => (
                    <div key={i} className="text-default-600">
                      <span className="font-medium">
                        {new Date(step.created_at).toLocaleDateString()}
                      </span>
                      {" — "}
                      {step.from_first_name} {step.from_last_name} ({step.from_email})
                      {" → "}
                      {step.to_email}
                    </div>
                  ))}
                </div>
              );
            },
          },
        ]}
      />
    </div>
  );
}
