import React from "react";
import {
  Dropdown as NextUIDropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
} from "@nextui-org/react";

export default function Dropdown({
  options,
  value,
  onChange,
  isDisabled,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  isDisabled?: boolean;
}) {
  return (
    <NextUIDropdown>
      <DropdownTrigger>
        <Button isDisabled={isDisabled}>
          {options.find((o) => o.id === value)?.label}
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        selectedKeys={[value]}
        selectionMode="single"
        variant="flat"
        onSelectionChange={(keys) =>
          Array.from(keys)[0] && onChange(Array.from(keys)[0] as string)
        }
      >
        {options.map((option) => (
          <DropdownItem key={option.id}>{option.label}</DropdownItem>
        ))}
      </DropdownMenu>
    </NextUIDropdown>
  );
}
