import { requestWithAuthAdmin, query } from "@/app/api/_common/endpoints";
import { s } from "ajv-ts";

export const GET = requestWithAuthAdmin(async (supabase) => {
  return {
    data: await query(() => supabase.from("questions").select("*, projects(name)")),
    projects: await query(() => supabase.from("projects").select("*")),
  };
});

const CreateQuestionRequestSchema = s.object({
  projectId: s.string(),
  questionId: s.string(),
  questionText: s.string(),
});

export const POST = requestWithAuthAdmin<
  s.infer<typeof CreateQuestionRequestSchema>
>(async (supabase, profile, request, body) => {
  const { projectId, questionText , questionId} = body;

  return query(() =>
    supabase.from("questions").insert({ project_id: projectId, question_id: questionId, question_text: questionText })
  );
}, CreateQuestionRequestSchema);
