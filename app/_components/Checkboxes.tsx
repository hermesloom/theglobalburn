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
  newkey: string;
  onChange: (value: string[]) => void;
  isDisabled?: boolean;
  description: string;
}) {
  const [isInvalid, setIsInvalid] = React.useState(true);
  return (

    <CheckboxGroup label={label} description={description} onChange={onChange}  isInvalid={isInvalid} onValueChange={(value) => {
      setIsInvalid(value.length < 1);
    }}>
      
        {options.map((option) => (
          <Checkbox key={option.id} value={option.id}>{option.label}</Checkbox>
        ))}
     
    </CheckboxGroup>
  );
}
