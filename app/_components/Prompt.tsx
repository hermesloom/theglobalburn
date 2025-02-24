import React, { useState } from "react";
import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Textarea,
  CheckboxGroup,
  Checkbox
} from "@nextui-org/react";
import Dropdown from "./Dropdown";
import Checkboxes from "./Checkboxes";
import Radiobuttons from "./Radiobuttons";
import ModalInput from "./Modalinput";

export type PromptField = {
  key: string;
  label?: string;
  multiLine?: boolean;
  checkboxes?: boolean;
  defaultValue?: string;
  readOnly?: boolean;
  canBeEmpty?: boolean;
  description?: string;
  checkboxoptions?: {
    id: string;
    label: string;
  }[];
  options?: {
    id: string;
    label: string;
  }[];
  validate?: (value: string) => boolean;
  propagateChanges?: (value: string) => { [key: string]: string };
  transform?: (value: string) => any;
};

export type PromptResult = {
  [key: string]: string;
};

export type PromptConfig = {
  id: string;
  message?: string | React.ReactNode;
  fields?: PromptField[];
  submitButtonText?: string;
  resolve: (value: PromptResult | undefined) => void;
};

export default function Prompt({ config }: { config: PromptConfig }) {
  const [isOpen, setIsOpen] = useState(true);
  const [inputs, setInputs] = useState<{ [key: string]: string }>(() => {
    const initialInputs: { [key: string]: string } = {};
    config.fields?.forEach((field) => {
      if (field.defaultValue !== undefined) {
        initialInputs[field.key] = field.defaultValue;
      }
    });
    return initialInputs;
  });

  const setInput = (key: string, value: string) => {
    let newInputs = { ...inputs, [key]: value };

    const field = config.fields?.find((f) => f.key === key);
    if (field?.propagateChanges) {
      Object.assign(newInputs, field.propagateChanges(value));
    }

    setInputs(newInputs);
  };

  return (
    <Modal
      isOpen={isOpen}
      size="3xl"
      onClose={() => {
        config.resolve(undefined);
        setIsOpen(false);
      }}
      scrollBehavior="outside"
    >
      <ModalContent className="p-4">
        {config.message ? <ModalHeader>{config.message}</ModalHeader> : null}
        <ModalBody>


          {config.fields?.map((field) =>
          
          
          field.options ? (

              <Dropdown
                key={field.key}
                label={field.label}
                description={field.description}
                options={field.options}
                value={inputs[field.key]}
                onChange={(value) => setInput(field.key, value)}
                isDisabled={field.readOnly}
              />
            ) : field.multiLine ? (
              <Textarea
                key={field.key}
                value={inputs[field.key] || ""}
                onChange={(e) => setInput(field.key, e.target.value)}
                label={field.label}
                description={field.description}
                isReadOnly={field.readOnly}
              />
            ) : field.checkboxes ? (
              <Checkboxes
                key={field.key}
                options={field.checkboxoptions}
                label={field.label}
                value={inputs[field.key]}
                description={field.description}
                onChange={(value) => setInput(field.key, value)}
                isDisabled={field.readOnly}

              />
            ): field.radiobuttons ? (
              <Radiobuttons
                key={field.key}
                options={field.radiooptions}
                label={field.label}
                value={inputs[field.key]}
                description={field.description}
                onChange={(value) => setInput(field.key, value)}
                isDisabled={field.readOnly}

              />
            )  
            : (

              <ModalInput
                key={field.key}
                value={inputs[field.key] || ""}
                onChange={(e) => setInput(field.key, e.target.value)}
                label={field.label}
                description={field.description}
                isReadOnly={field.readOnly}
              />
            )
          )}

          <Button
            color="primary"
            isDisabled={config.fields?.some(
              (field) =>
                (!field.canBeEmpty && !inputs[field.key]) ||
                (field.validate && !field.validate(inputs[field.key]))
            )}
            onPress={() => {
              config.fields?.forEach((field) => {
                if (field.transform) {
                  inputs[field.key] = field.transform(inputs[field.key]);
                }
              });

              config.resolve(inputs);
              setIsOpen(false);
            }}
          >
            {config.submitButtonText
              ? config.submitButtonText
              : config.fields?.every((f) => f.readOnly)
                ? "Close"
                : "Submit"}
          </Button>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
