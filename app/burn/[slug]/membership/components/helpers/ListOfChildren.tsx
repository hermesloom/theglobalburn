import React, { useState } from "react";
import Heading from "@/app/_components/Heading";
import { usePrompt } from "@/app/_components/PromptContext";
import ActionButton from "@/app/_components/ActionButton";
import BasicTable from "@/app/_components/BasicTable";
import { v4 as uuidv4 } from "uuid";
import { apiPatch } from "@/app/_components/api";
import { useProject } from "@/app/_components/SessionContext";
import { DeleteOutlined } from "@ant-design/icons";
import { calculateAge } from "./date";

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
                  validate: (value: string) => {
                    // Just validate the date format and that it's a valid date
                    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                    if (!dateRegex.test(value)) {
                      return false;
                    }

                    const dob = new Date(value);
                    return !isNaN(dob.getTime());
                  },
                },
              ]),
            handler: async (_, promptData) => {
              // Check age validation before saving
              const dob = new Date((promptData as any).dob);
              const eventEndDate = project?.burn_config?.event_end_date
                ? new Date(project.burn_config.event_end_date)
                : null;

              if (eventEndDate) {
                const ageAtEventEnd = calculateAge(dob, eventEndDate);
                if (ageAtEventEnd >= 14) {
                  alert(`This child will be ${ageAtEventEnd} years old by the event. Children who are 14 or older need their own membership.`);
                  return;
                }
              }

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
