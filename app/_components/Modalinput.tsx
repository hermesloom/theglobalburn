import React from "react";
import {
  CheckboxGroup,
  Checkbox,
  Button,
  Input

} from "@nextui-org/react";

export default function ModalInput({
  value,
  description,
  label,
  onChange,
  isDisabled,
}: {

  value: string;
  label: string;
  onChange: (value: string) => void;
  isDisabled?: boolean;
  description: string;
}) {
  return (
    <>
      <div>{label}</div>
      <div>
        <p>{description}</p>
      </div>
      <Input

        value={value}

        label={label}
        description={description}

        
      />
    </>

  );
}
