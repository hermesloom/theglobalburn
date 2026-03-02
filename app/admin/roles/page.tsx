"use client";

import React from "react";
import DataTable from "@/app/_components/DataTable";
import { usePrompt } from "@/app/_components/PromptContext";
import { apiPost } from "@/app/_components/api";

export default function RolesPage() {
  const prompt = usePrompt();

  return (
    <DataTable
      endpoint="/admin/roles"
      columns={[
        {
          key: "project",
          label: "Project",
          render: (_, row: any) => row.projects.name,
        },
        { key: "name", label: "Name" },
      ]}
      title="Roles"
      globalActions={[
        {
          key: "add-role",
          label: "Add role",
          onClick: {
            prompt: (fullData) =>
              prompt("Enter details about the new role.", [
                {
                  key: "projectId",
                  label: "Project",
                  options: fullData!.projects.map((p: any) => ({
                    id: p.id,
                    label: p.name,
                  })),
                },
                { key: "name", label: "Name" },
              ]),
            handler: async (_, promptResult) => {
              await apiPost("/admin/roles", promptResult);
              return true;
            },
          },
        },
      ]}
    />
  );
}
