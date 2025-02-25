"use client";

import React, { useState } from "react";
import { Button, Tooltip } from "@nextui-org/react";
import { PromptResult } from "@/app/_components/Prompt";

export type ActionButtonOnClickHandler<T> = (
  data?: T,
  promptResult?: PromptResult,
) => Promise<boolean | void>;

export type ActionButtonDef<T = undefined> = {
  key: string;
  label?: string;
  icon?: React.ReactNode;
  tooltip?: string;
  allowLineBreaks?: boolean;
  condition?: (data?: T) => boolean;
  onClick:
    | ActionButtonOnClickHandler<T>
    | {
        prompt: (data?: T) => Promise<PromptResult | undefined>;
        handler: ActionButtonOnClickHandler<T>;
      };
  successCallback?: () => void;
};

export default function ActionButton<T>({
  action,
  data,
  ...props
}: {
  action: ActionButtonDef<T>;
  data?: T;
  [key: string]: any;
}) {
  const [loading, setLoading] = useState(false);

  const condition = action.condition ? action.condition(data) : true;
  if (!condition) {
    return null;
  }

  const button = (
    <Button
      {...props}
      isIconOnly={!action.label && !!action.icon}
      isLoading={loading}
      className={
        action.allowLineBreaks ? "whitespace-normal min-h-10 h-auto" : undefined
      }
      onPress={async () => {
        try {
          const handler =
            typeof action.onClick === "function"
              ? action.onClick
              : action.onClick.handler;
          const promptHandler =
            typeof action.onClick !== "function"
              ? action.onClick.prompt
              : undefined;
          const promptResult = promptHandler
            ? await promptHandler(data)
            : undefined;

          if (!promptHandler || promptResult) {
            setLoading(true);
            const handlerResult = await handler(data, promptResult);
            if (handlerResult && action.successCallback) {
              action.successCallback();
            }
          }
        } finally {
          setLoading(false);
        }
      }}
    >
      {action.icon}
      {action.label}
    </Button>
  );

  if (action.tooltip) {
    return <Tooltip content={action.tooltip}>{button}</Tooltip>;
  }
  return button;
}
