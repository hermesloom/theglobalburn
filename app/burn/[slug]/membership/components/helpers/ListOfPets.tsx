import React, { useState } from "react";
import Heading from "@/app/_components/Heading";
import { usePrompt } from "@/app/_components/PromptContext";
import ActionButton from "@/app/_components/ActionButton";
import BasicTable from "@/app/_components/BasicTable";
import { v4 as uuidv4 } from "uuid";
import { apiPatch, apiDelete } from "@/app/_components/api";
import { useProject } from "@/app/_components/SessionContext";
import { DeleteOutlined } from "@ant-design/icons";

export interface Pet {
  key: string;
  firstName: string;
  lastName: string;
  dob: string;
}

export default function ListOfPets({ data }: { data: Pet[] }) {
  const [pets, setPets] = useState(data);
  const { project } = useProject();
  const columns = [
    {
      key: "name",
      label: "Name",
    },
    {
      key: "type",
      label: "Type",
    },
    {
      key: "chip_code",
      label: "Chip Code"
    },
  ];

  const prompt = usePrompt();

  const updatePets = async (newPets: Pet[]) => {
    await apiPatch(`/burn/${project!.slug}/pets`, {
      pets: newPets,
    });
    setPets(newPets);
  };

  return (
    <>
      <Heading className="mt-12">Accompanying pets</Heading>
      {pets?.length > 0 ? (
        <BasicTable
          data={pets}
          columns={columns}
          rowsPerPage={10}
          ariaLabel={`pets`}
          noPagination
          rowActions={[
            {
              key: "delete",
              icon: <DeleteOutlined />,
              onClick: async (data) => {
                await updatePets(
                  pets.filter((pet) => pet.key !== (data as Pet).key),
                );
              },
            },
          ]}
        />
      ) : null}
      <ActionButton
        style={pets?.length > 0 ? { marginTop: "0.5rem" } : {}}
        action={{
          key: "addPet",
          label: `Add pet`,
          onClick: {
            prompt: () =>
              prompt("Enter the details of the pet", [
                {
                  key: "name",
                  label: "Name",
                },
                {
                  key: "type",
                  label: "Type (click to choose)",
                  type: "dropdown",
                  options: [
                    { id: 'Dog', label: 'Dog' },
                    { id: 'Cat', label: 'Cat' },
                    { id: 'Other', label: 'Other' }
                  ],
                  readOnly: false,
                  validate: (value: string) =>
                    ['Dog', 'Cat', 'Other'].includes(value)
                },
                {
                  key: "chip_code",
                  label: "Chip Code",
                },
              ]),
            handler: async (_, promptData) => {
              await updatePets([
                ...pets,
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

