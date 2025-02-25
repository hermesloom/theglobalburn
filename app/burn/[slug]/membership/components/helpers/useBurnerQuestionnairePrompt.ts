import { usePrompt } from "@/app/_components/PromptContext";

export type BurnerQuestionnaireResult = {
  favorite_principle: string;
};

export const useBurnerQuestionnairePrompt = () => {
  const prompt = usePrompt();

  return () =>
    prompt("First, please answer the following questions.", [
      {
        key: "favorite_principle",
        label: "What is your favorite burner principle?",
      },
    ]);
};
