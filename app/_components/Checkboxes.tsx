import React from "react";
import {
  CheckboxGroup, 
  Checkbox,
  Button

} from "@nextui-org/react";

export default function Checkboxes({
  options,
  value,
  description,
  label,
  onChange,
  isDisabled,
}: {
  options: { id: string; label: string }[];
  value: string;
  label: string;
  key: string;
  onChange: (value: string[]) => void;
  isDisabled?: boolean;
  description: string;
}) {
  return (

    <CheckboxGroup label={label} description={description} onChange={onChange}>
      
        {options.map((option) => (
          <Checkbox value={option.id}>{option.label}</Checkbox>
        ))}
     
    </CheckboxGroup>
  );
}
