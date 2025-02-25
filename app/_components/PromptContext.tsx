"use client";

import React, { createContext, useContext, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import Prompt, {
  PromptConfig,
  PromptField,
  PromptResult,
  SubmitButtonTextParams,
} from "./Prompt";

type PromptContextType = (
  message?: string | React.ReactNode,
  fields?: PromptField[],
  submitButtonText?: string | ((params: SubmitButtonTextParams) => string),
) => Promise<PromptResult | undefined>;

const PromptContext = createContext<PromptContextType>(() => Promise.reject());

export function PromptProvider({ children }: { children: React.ReactNode }) {
  const [activePrompts, setActivePrompts] = useState<PromptConfig[]>([]);

  const prompt = (
    message?: string | React.ReactNode,
    fields?: PromptField[],
    submitButtonText?: string | ((params: SubmitButtonTextParams) => string),
  ) => {
    return new Promise<PromptResult | undefined>((resolve) => {
      const id = uuidv4();

      setActivePrompts([
        ...activePrompts,
        {
          id,
          message,
          fields,
          submitButtonText,
          resolve: (res) => {
            resolve(res);

            // small delay to allow the closing animation to play
            setTimeout(() => {
              setActivePrompts((prompts) => prompts.filter((p) => p.id !== id));
            }, 500);
          },
        },
      ]);
    });
  };

  return (
    <PromptContext.Provider value={prompt}>
      {children}
      {activePrompts.map((prompt) => (
        <Prompt key={prompt.id} config={prompt} />
      ))}
    </PromptContext.Provider>
  );
}

export const usePrompt = () => useContext(PromptContext);
