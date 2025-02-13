"use client";

import React from "react";
import DataTable from "@/app/_components/DataTable";
import { useSession } from "@/app/_components/SessionContext";
import { usePrompt } from "@/app/_components/PromptContext";
import { apiPost } from "@/app/_components/api";

export default function QuestionsPage() {
  const prompt = usePrompt();

  return (
    <DataTable
      endpoint="/admin/questions"
      columns={[
        {
          key: "project",
          label: "Project",
          render: (_, row: any) => row.projects.name,
        },
        {
          key: "question_id",
          label: "Question ID",
        },
        { key: "question_text", label: "Question" },
      ]}
      title="Burner Questions"
      globalActions={[
        {
          key: "add-question",
          label: "Add question",
          onClick: {
            prompt: (fullData) =>
              prompt("Enter your question.", [
                {
                  key: "projectId",
                  label: "Project",
                  options: fullData!.projects.map((p: any) => ({
                    id: p.id,
                    label: p.name,
                  })),
                },
                {
                  key: "questionText",
                  label: "Question text",
                  propagateChanges: (name) => ({
                    questionId: name
                      .toLowerCase()
                      .replace(/ß/g, "ss")
                      .normalize("NFD")
                      .replace(/ +/g, "-")
                      .replace(/[^a-z0-9-]+/g, ""),
                  }),
                },
                {
                  key: "questionId",
                  label: "Question key",
                },
              ]),
            handler: async (_, promptResult) => {
              await apiPost("/admin/questions", promptResult);
              return true;
            },
          },
        },
      ]}
    />
  );
}
