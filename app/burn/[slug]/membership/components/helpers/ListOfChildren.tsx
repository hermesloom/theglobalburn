import React, { useState } from 'react';
import { Table, Input, TableColumn, TableHeader, TableBody, TableCell, TableRow } from '@nextui-org/react';
import Heading from '@/app/_components/Heading';
import { usePrompt } from '@/app/_components/PromptContext';
import ActionButton from '@/app/_components/ActionButton';

export interface Child {
  firstName: string | (readonly string[] & string) | undefined;
  lastName: string | (readonly string[] & string) | undefined;
  dob: string | (readonly string[] & string) | undefined;
}

export default function ListOfChildren({ data }: { data: Child[] }) {
  const [children, setChildren] = useState(data);

  interface ListOfChildrenProps {
    data: Child[];
  }

  const handleInputChange = (index: number, field: keyof Child, value: string) => {
    const newChildren = [...children];
    newChildren[index][field] = value;
    setChildren(newChildren);
  };
  const prompt = usePrompt();
  return (
    <><Heading className="mt-12">Children</Heading><Table>
      <TableHeader>
        <TableColumn>First name</TableColumn>
        <TableColumn>Last name</TableColumn>
        <TableColumn>Date of birth</TableColumn>
      </TableHeader>
      <TableBody>
        {children.map((child: { firstName: string | (readonly string[] & string) | undefined; lastName: string | (readonly string[] & string) | undefined; dob: string | (readonly string[] & string) | undefined; }, index: React.Key | null | undefined) => (
          <TableRow key={index}>
            <TableCell>
              <Input
                value={child.firstName}
                onChange={(e) => handleInputChange(index as number, 'firstName', e.target.value)} />
            </TableCell>
            <TableCell>
              <Input
                value={child.lastName}
                onChange={(e) => handleInputChange(index as number, 'lastName', e.target.value)} />
            </TableCell>
            <TableCell>
              <Input
                value={child.dob}
                onChange={(e) => handleInputChange(index as number, 'dob', e.target.value)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
      <ActionButton
                    action={{
                      key: "addChild",
                      label: `Add child`,
                       onClick: {
                                  prompt: () =>
                                    prompt("Enter the details of the child", [
                                      {
                                        key: "firstName",
                                        label: "First name",
                                        
                                      },
                                      {
                                        key: "lastName",
                                        label: "Last name",
                                        
                                      },
                                      {
                                        key: "dob",
                                        label: "Date of birth",
                                        
                                      },
                                    ]),
                                  handler: async (_, promptData) => {
                                    console.log(promptData);
                                    if (promptData && 'firstName' in promptData && 'lastName' in promptData && 'dob' in promptData) {
                                      setChildren([...children, promptData as Child]);
                                    }
                                    return true;
                                  },
                                },
                    }}
                  /></>
  );
};

