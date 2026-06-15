"use client";

import React, { useState } from "react";
import DataTable, { FullData } from "@/app/_components/DataTable";
import Dropdown from "@/app/_components/Dropdown";
import { usePrompt } from "@/app/_components/PromptContext";
import { apiPost } from "@/app/_components/api";

export default function RoleAssignmentsPage() {
  const prompt = usePrompt();
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [roleOptions, setRoleOptions] = useState<{ id: string; label: string }[]>([]);

  const handleFullDataLoaded = (fullData: FullData) => {
    if (roleOptions.length === 0) {
      setRoleOptions(
        fullData.roles.map((r: any) => ({
          id: r.id,
          label: r.projects.name + " - " + r.name,
        }))
      );
    }
  };

  const endpoint = selectedRoleId
    ? `/admin/role-assignments?roleId=${selectedRoleId}`
    : "/admin/role-assignments";

  return (
    <div>
      {roleOptions.length > 0 && (
        <div className="mb-4">
          <Dropdown
            buttonPrefix="Role: "
            options={[{ id: "", label: "All" }, ...roleOptions]}
            value={selectedRoleId}
            onChange={setSelectedRoleId}
          />
        </div>
      )}
      <DataTable
        key={selectedRoleId}
        endpoint={endpoint}
        onFullDataLoaded={handleFullDataLoaded}
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
                    type: "dropdown",
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
    </div>
  );
}
