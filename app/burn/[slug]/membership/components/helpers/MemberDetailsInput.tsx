"use client";

import React, { useEffect, useState } from "react";
import { Input, Checkbox } from "@nextui-org/react";
import { calculateAge } from "@/app/_components/utils";
import { usePrompt } from "@/app/_components/PromptContext";
import { MemberDetailsData } from "./MemberDetails";
import { useLowIncomeQuestionnairePrompt } from "./useLowIncomeQuestionnaire";

export default function MemberDetailsInput({
  value,
  setValue,
  ageValidation,
  withLowIncome,
  withLowIncomePrompt,
}: {
  value: MemberDetailsData | null;
  setValue: (value: MemberDetailsData | null) => void;
  ageValidation?: (birthdate: string) => boolean;
  withLowIncome?: boolean;
  withLowIncomePrompt?: boolean;
}) {
  const prompt = usePrompt();
  const [firstName, setFirstName] = useState(value?.first_name ?? "");
  const [lastName, setLastName] = useState(value?.last_name ?? "");
  const [birthdate, setBirthdate] = useState(value?.birthdate ?? "");
  const [isLowIncome, setIsLowIncome] = useState(value?.is_low_income ?? false);
  const [lowIncomeQuestionnaireResult, setLowIncomeQuestionnaireResult] =
    useState(value?.metadata?.low_income_questionnaire_result ?? undefined);
  const lowIncomeQuestionnaire = useLowIncomeQuestionnairePrompt();

  const isBirthdateWellFormatted = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(
    birthdate,
  );
  const isAgeValid =
    isBirthdateWellFormatted && (!ageValidation || ageValidation(birthdate));

  useEffect(() => {
    if (!firstName || !lastName || !isAgeValid) {
      setValue(null);
      return;
    }

    const obj: MemberDetailsData = {
      first_name: firstName,
      last_name: lastName,
      birthdate: birthdate,
      is_low_income: isLowIncome,
      metadata: {
        low_income_questionnaire_result: lowIncomeQuestionnaireResult,
      },
    };

    if (!withLowIncome) {
      delete obj.is_low_income;
    }

    setValue(obj);
  }, [
    firstName,
    lastName,
    birthdate,
    isLowIncome,
    lowIncomeQuestionnaireResult,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="First name"
        value={firstName}
        onValueChange={setFirstName}
      />
      <Input label="Last name" value={lastName} onValueChange={setLastName} />
      <Input
        label="Date of birth (YYYY-MM-DD)"
        value={birthdate}
        onValueChange={setBirthdate}
        isInvalid={isBirthdateWellFormatted && !isAgeValid}
        errorMessage={
          isBirthdateWellFormatted && !isAgeValid
            ? "You must be at least 14 years old when the burn starts"
            : undefined
        }
      />
      {withLowIncome ? (
        <Checkbox
          isSelected={isLowIncome}
          onValueChange={async (newIsLowIncome) => {
            if (newIsLowIncome) {
              if (withLowIncomePrompt) {
                const liq = await lowIncomeQuestionnaire();
                if (liq.isEligible) {
                  setIsLowIncome(true);
                  setLowIncomeQuestionnaireResult(liq.result);
                }
              } else {
                setIsLowIncome(true);
              }
            } else {
              setIsLowIncome(false);
            }
          }}
        >
          Low income?
        </Checkbox>
      ) : null}
    </div>
  );
}
