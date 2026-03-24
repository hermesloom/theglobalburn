"use client";

import React from "react";
import { Input } from "@nextui-org/react";
import { LockOutlined } from "@ant-design/icons";
import { LowIncomeQuestionnaireResult } from "./useLowIncomeQuestionnaire";
import { Child } from "./ListOfChildren";

export type MemberDetailsData = {
  first_name: string;
  last_name: string;
  birthdate: string;
  /** When `0`, income tier shows as manually issued (e.g. admin-issued membership). */
  price?: number;
  is_low_income?: boolean;
  metadata?: {
    low_income_questionnaire_result?: LowIncomeQuestionnaireResult;
    children?: Child[];
  };
};

export default function MemberDetails({ data }: { data: MemberDetailsData }) {
  return (
    <>
      <Input
        label="First name"
        value={data.first_name || ""}
        isDisabled
        startContent={<LockOutlined />}
      />
      <Input
        label="Last name"
        value={data.last_name || ""}
        isDisabled
        startContent={<LockOutlined />}
      />
      <Input
        label="Date of birth"
        value={data.birthdate || ""}
        isDisabled
        startContent={<LockOutlined />}
      />
      {data.is_low_income !== undefined || data.price === 0 ? (
        <p className="text-sm text-gray-500">
          {data.price === 0
            ? "Manually issued membership"
            : data.is_low_income
              ? "Low income"
              : "Regular or high income"}
        </p>
      ) : null}
    </>
  );
}
