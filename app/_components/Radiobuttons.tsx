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
  const [isInvalid, setIsInvalid] = React.useState(true);
  return (

    <RadioGroup key={newkey} label={label} description={description} isInvalid={isInvalid} onChange={(e) => onChange(e.target.value)} onValueChange={(value) => {
      setIsInvalid(value.length < 1);
    }}>
      
        {options.map((option) => (
          <Radio key={option.id} value={option.id}>{option.label}</Radio>
        ))}
     
    </RadioGroup>
  );
}
