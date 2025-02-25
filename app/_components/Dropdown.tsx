import React from "react";
import {
  Dropdown as NextUIDropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button

} from "@nextui-org/react";

export default function Dropdown({
  options,
  description,
  value,
  label,
  onChange,
  isDisabled,
}: {
  options: { id: string; label: string }[];
  description: string;
  value: string;
  label: string;
  onChange: (value: string) => void;
  isDisabled?: boolean;
}) {
  return (
   <>
   <div class="relative text-medium text-foreground-500">{label}</div>
   
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
    <div>
    <p class="text-tiny text-foreground-400">{description}</p>
    </div>
    </>
  );
}
