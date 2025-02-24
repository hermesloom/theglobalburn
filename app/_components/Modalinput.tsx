import React from "react";
import {
  CheckboxGroup,
  Checkbox,
  Button,
  Input

} from "@nextui-org/react";
import { on } from "events";

export default function ModalInput({
  key,
  value,
  description,
  label,
  onChange,
  isDisabled,
}: {
  key: string;
  value: string;
  label: string;
  onChange: (value: string) => void;
  isDisabled?: boolean;
  description: string;
}) {
  return (
    <>
      <div>{label}</div>
      
      <Input

        key={key}
        value={value || ""}
        onChange={(e) => onChange(e)}
        label={label}
        description={description}
        

        
      />
    </>

  );
}
