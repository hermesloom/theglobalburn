import React, { useState } from "react";
import Heading from "@/app/_components/Heading";
import { usePrompt } from "@/app/_components/PromptContext";
import ActionButton from "@/app/_components/ActionButton";
import BasicTable from "@/app/_components/BasicTable";
import { v4 as uuidv4 } from "uuid";
import { apiPatch } from "@/app/_components/api";
import { useProject } from "@/app/_components/SessionContext";

export interface Child {
  key: string | (readonly string[] & string) | undefined;
  firstName: string | (readonly string[] & string) | undefined;
  lastName: string | (readonly string[] & string) | undefined;
  dob: string | (readonly string[] & string) | undefined;
}

export default function ListOfChildren({ data }: { data: Child[] }) {
  const [children, setChildren] = useState(data);
  const { project } = useProject();
  const childColumns = [
    {
      key: "first_name",
      label: "First name",
    },
    {
      key: "last_name",
      label: "Last name",
    },
    {
      key: "dob",
      label: "Date of birth",
    },
  ];

  const prompt = usePrompt();

  return (
    <>
      <Heading className="mt-12">Accompanying children</Heading>
      <BasicTable
        data={children}
        columns={childColumns}
        rowsPerPage={10}
        ariaLabel={`Children`}
      />
      <ActionButton
        action={{
          key: "addChild",
          label: `Add child`,
          onClick: {
            prompt: () =>
              prompt("Enter the details of the child", [
                {
                  key: "first_name",
                  label: "First name",
                },
                {
                  key: "last_name",
                  label: "Last name",
                },
                {
                  key: "dob",
                  label: "Date of birth",
                },
              ]),
            handler: async (_, promptData) => {
              if (
                promptData &&
                "first_name" in promptData &&
                "last_name" in promptData &&
                "dob" in promptData
              ) {
                promptData["key"] = uuidv4();
                setChildren([...children, promptData as any as Child]);
                await apiPatch(`/burn/${project!.slug}/manage-children`, {
                  key: promptData.key,
                  first_name: promptData.first_name,
                  last_name: promptData.last_name,
                  dob: promptData.dob,
                });
              }
              return true;
            },
          },
        }}
      />
    </>
  );
}
