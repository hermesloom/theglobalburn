import React from "react";
import {
  RadioGroup, 
  Radio,
  Button

} from "@nextui-org/react";

export default function Radiobuttons({
  options,
  newkey,
  value,
  description,
  label,
  onChange,
  isDisabled,
}: {
  options: { id: string; label: string }[];
  newkey: string;
  value: string;
  label: string;
  onChange: (value: string) => void;

  isDisabled?: boolean;
  description: string;
}) {
  return (

    <RadioGroup key={newkey} label={label} description={description} onChange={(e) => onChange(e.target.value)}>
      
        {options.map((option) => (
          <Radio key={option.id} value={option.id}>{option.label}</Radio>
        ))}
     
    </RadioGroup>
  );
}
