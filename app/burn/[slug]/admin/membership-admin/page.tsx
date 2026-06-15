"use client";

import React, { useState } from "react";
import { Button } from "@nextui-org/react";
import { useProject } from "@/app/_components/SessionContext";
import { apiGet } from "@/app/_components/api";
import toast from "react-hot-toast";
import { calculateAge } from "@/app/burn/[slug]/membership/components/helpers/date";

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
    <div>
      <h1 className="text-2xl font-bold mb-6">Membership Admin</h1>
      <div className="flex gap-4">
        <Button color="primary" onPress={downloadChildrenCsv} isLoading={loadingChildren}>
          Download members with children (CSV)
        </Button>
        <Button color="primary" onPress={downloadPetsCsv} isLoading={loadingPets}>
          Download members with pets (CSV)
        </Button>
      </div>
    </div>
  );
}
