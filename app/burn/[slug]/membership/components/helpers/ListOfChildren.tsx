import React, { useState } from "react";
import Heading from "@/app/_components/Heading";
import { usePrompt } from "@/app/_components/PromptContext";
import ActionButton from "@/app/_components/ActionButton";
import BasicTable from "@/app/_components/BasicTable";
import { v4 as uuidv4 } from "uuid";
import { apiPatch, apiDelete } from "@/app/_components/api";
import { useProject } from "@/app/_components/SessionContext";
import { DeleteOutlined } from "@ant-design/icons";

export interface Child {
  key: string;
  firstName: string;
  lastName: string;
  dob: string;
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
      render: (value: string) => new Date(value).toISOString().slice(0, 10),
    },
  ];

  const prompt = usePrompt();

  const updateChildren = async (newChildren: Child[]) => {
    await apiPatch(`/burn/${project!.slug}/children`, {
      children: newChildren,
    });
    setChildren(newChildren);
  };

  return (
    <>
      <Heading className="mt-12">Accompanying children</Heading>
      {children?.length > 0 ? (
        <BasicTable
          data={children}
          columns={childColumns}
          rowsPerPage={10}
          ariaLabel={`Children`}
          noPagination
          rowActions={[
            {
              key: "delete",
              icon: <DeleteOutlined />,
              onClick: async (data) => {
                await updateChildren(
                  children.filter((child) => child.key !== (data as Child).key),
                );
              },
            },
          ]}
        />
      ) : null}
      <ActionButton
        style={children?.length > 0 ? { marginTop: "0.5rem" } : {}}
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
                  label: "Date of birth (YYYY-MM-DD)",
                  validate: (value: string) =>
                    !isNaN(new Date(value).getTime()),
                },
              ]),
            handler: async (_, promptData) => {
              await updateChildren([
                ...children,
                {
                  key: uuidv4(),
                  ...(promptData as any),
                },
              ]);
            },
          },
        }}
      />
    </>
  );
}
