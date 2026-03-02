import { usePrompt } from "@/app/_components/PromptContext";

export type LowIncomeQuestionnaireResult = {
  monthly_income: string;
};

export function useLowIncomeQuestionnairePrompt(): () => Promise<
  | { isEligible: false }
  | {
      isEligible: true;
      result: LowIncomeQuestionnaireResult;
    }
> {
  const prompt = usePrompt();

  return async () => {
    const result: LowIncomeQuestionnaireResult | undefined = (await prompt(
      "Please answer a few questions to determine your eligibility for low income membership.",
      [
        // TODO: add more questions here
        {
          key: "monthly_income",
          label: "What is your monthly income in SEK?",
          validate: (value) => !isNaN(parseInt(value)),
        },
        {
          key: "assets",
          label:
            "What is the total value of your assets in SEK (e.g. savings, investments, property, etc.)?",
          validate: (value) => !isNaN(parseInt(value)),
        },
      ]
    )) as LowIncomeQuestionnaireResult | undefined;

    if (!result) {
      return { isEligible: false };
    }

    // decision made with Wanda (2025-01-20): no check in the frontend, the results are just stored for reference
    /*const isEligible = parseInt(result.monthly_income) < 20000;

    if (isEligible) {
      toast.success(
        "Congratulations! You are eligible for low income membership."
      );
    } else {
      toast.error(
        "Unfortunately you are not eligible for low income membership."
      );
    }*/

    return { isEligible: true, result };
  };
}
