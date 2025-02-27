import React, { useState } from "react";
import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
  Checkbox,
  RadioGroup,
  Radio,
  CheckboxGroup,
} from "@nextui-org/react";
import Dropdown from "./Dropdown";

export type PromptField = {
  key: string;
  label?: string;
  multiLine?: boolean;
  defaultValue?: string;
  readOnly?: boolean;
  canBeEmpty?: boolean;
  type?:
    | "text"
    | "textWithTopLabel"
    | "checkbox"
    | "checkboxGroup"
    | "radio"
    | "dropdown";
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

export type SubmitButtonTextParams = {
  unfinishedFieldIndices: number[];
};

export type PromptConfig = {
  id: string;
  message?: string | React.ReactNode;
  fields?: PromptField[];
  submitButtonText?: string | ((params: SubmitButtonTextParams) => string);
  resolve: (value: PromptResult | undefined) => void;
};

export default function Prompt({ config }: { config: PromptConfig }) {
  const [isOpen, setIsOpen] = useState(true);
  const [inputs, setInputs] = useState<{ [key: string]: string }>(() => {
    const initialInputs: { [key: string]: string } = {};
    config.fields?.forEach((field) => {
      if (field.defaultValue !== undefined) {
        initialInputs[field.key] = field.defaultValue;
      } else if (field.type === "checkboxGroup") {
        initialInputs[field.key] = "";
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

  const renderLabel = (label?: string) => {
    if (!label) return null;
    return (
      <div className="block text-small font-medium text-foreground pb-1.5">
        {label}
      </div>
    );
  };

  const unfinishedFieldIndices =
    config.fields
      ?.map((field, index) => ({ index, field }))
      .filter(
        ({ field }) =>
          (!field.canBeEmpty && !inputs[field.key]) ||
          (field.validate && !field.validate(inputs[field.key])),
      )
      .map((f) => f.index) ?? [];

  const submitDisabled = unfinishedFieldIndices.length > 0;

  const renderField = (field: PromptField) => {
    switch (field.type) {
      case "textWithTopLabel":
        return (
          <div key={field.key}>
            {renderLabel(field.label)}
            {field.multiLine ? (
              <Textarea
                value={inputs[field.key] || ""}
                onChange={(e) => setInput(field.key, e.target.value)}
                isReadOnly={field.readOnly}
              />
            ) : (
              <Input
                value={inputs[field.key] || ""}
                onChange={(e) => setInput(field.key, e.target.value)}
                isReadOnly={field.readOnly}
              />
            )}
          </div>
        );

      case "checkbox":
        return (
          <div key={field.key}>
            {renderLabel(field.label)}
            <Checkbox
              isSelected={inputs[field.key] === "true"}
              onValueChange={(checked) =>
                setInput(field.key, checked.toString())
              }
              isDisabled={field.readOnly}
            >
              {field.label}
            </Checkbox>
          </div>
        );

      case "radio":
        return field.options ? (
          <div key={field.key}>
            {renderLabel(field.label)}
            <RadioGroup
              value={inputs[field.key]}
              onValueChange={(value) => setInput(field.key, value)}
              isDisabled={field.readOnly}
            >
              {field.options.map((option) => (
                <Radio key={option.id} value={option.id}>
                  {option.label}
                </Radio>
              ))}
            </RadioGroup>
          </div>
        ) : null;

      case "dropdown":
        return (
          <div key={field.key}>
            {renderLabel(field.label)}
            <Dropdown
              options={field.options || []}
              value={inputs[field.key]}
              onChange={(value) => setInput(field.key, value)}
              isDisabled={field.readOnly}
            />
          </div>
        );

      case "checkboxGroup":
        return field.options ? (
          <div key={field.key}>
            {renderLabel(field.label)}
            <CheckboxGroup
              value={inputs[field.key]?.split(",").filter(Boolean)}
              onValueChange={(values) => setInput(field.key, values.join(","))}
              isDisabled={field.readOnly}
            >
              {field.options.map((option) => (
                <Checkbox key={option.id} value={option.id}>
                  {option.label}
                </Checkbox>
              ))}
            </CheckboxGroup>
          </div>
        ) : null;

      default:
        return field.multiLine ? (
          <Textarea
            key={field.key}
            value={inputs[field.key] || ""}
            onChange={(e) => setInput(field.key, e.target.value)}
            label={field.label}
            isReadOnly={field.readOnly}
          />
        ) : (
          <Input
            key={field.key}
            value={inputs[field.key] || ""}
            onChange={(e) => setInput(field.key, e.target.value)}
            label={field.label}
            isReadOnly={field.readOnly}
          />
        );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        config.resolve(undefined);
        setIsOpen(false);
      }}
      placement="top"
    >
      <ModalContent>
        {(onClose) => (
          <>
            {config.message ? (
              <ModalHeader className="px-10 pt-10">
                {config.message}
              </ModalHeader>
            ) : null}
            <ModalBody className="px-10 pb-10">
              <div className="space-y-8">
                {config.fields?.map((field) => renderField(field))}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                color="primary"
                fullWidth
                isDisabled={submitDisabled}
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
                {typeof config.submitButtonText === "string"
                  ? config.submitButtonText
                  : typeof config.submitButtonText === "function"
                    ? config.submitButtonText({ unfinishedFieldIndices })
                    : config.fields?.every((f) => f.readOnly)
                      ? "Close"
                      : "Submit"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
