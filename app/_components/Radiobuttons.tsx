import React from "react";
import {
  RadioGroup, 
  Radio,
  Button

} from "@nextui-org/react";

export default function Radiobuttons({
  options,
  key,
  value,
  description,
  label,
  onChange,
  isDisabled,
}: {
  options: { id: string; label: string }[];
  key: string;
  value: string;
  label: string;
  onChange: (value: string) => void;

  isDisabled?: boolean;
  description: string;
}) {
  return (

    <RadioGroup key={key} label={label} description={description} onChange={(e) => onChange(e.target.value)}>
      
        {options.map((option) => (
          <Radio value={option.id}>{option.label}</Radio>
        ))}
     
    </RadioGroup>
  );
}
