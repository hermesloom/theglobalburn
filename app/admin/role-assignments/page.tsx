"use client";

import React from "react";
import DataTable from "@/app/_components/DataTable";
import { usePrompt } from "@/app/_components/PromptContext";
import { apiPost } from "@/app/_components/api";

export default function RoleAssignmentsPage() {
  const prompt = usePrompt();

  return (
    <DataTable
      endpoint="/admin/role-assignments"
      columns={[
        {
          key: "project",
          label: "Project",
          render: (_, row: any) => row.roles.projects.name,
        },
        {
          key: "email",
          label: "Email",
          render: (_, row: any) => row.profiles.email,
        },
        { key: "role", label: "Role", render: (_, row: any) => row.roles.name },
      ]}
      title="Role assignments"
      globalActions={[
        {
          key: "add-role-assignment",
          label: "Add role assignment",
          onClick: {
            prompt: (fullData) =>
              prompt("Enter details about the new role assignment.", [
                { key: "email", label: "Email" },
                {
                  key: "roleId",
                  label: "Role",
                  options: fullData!.roles.map((r: any) => ({
                    id: r.id,
                    label: r.projects.name + " - " + r.name,
                  })),
                },
              ]),
            handler: async (_, promptResult) => {
              await apiPost("/admin/role-assignments", promptResult);
              return true;
            },
          },
        },
      ]}
    />
  );
}
