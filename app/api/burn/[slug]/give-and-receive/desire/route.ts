import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { s } from "ajv-ts";
import { NextResponse } from "next/server";
import { BurnRole } from "@/utils/types";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DesireRequestSchema = s.object({
  text_content: s.string(),
});

export const POST = requestWithProject<s.infer<typeof DesireRequestSchema>>(
  async (supabase, profile, request, body, project) => {
    // Check if user has an active membership
    if (!project?.membership) {
      return NextResponse.json(
        { error: "You need an active membership to use this feature" },
        { status: 403 },
      );
    }

    try {
      // Generate embedding for the desire text using OpenAI API
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: body.text_content,
      });

      const embedding = embeddingResponse.data[0].embedding;

      // Create the desire with the embedding
      const result = await query(() =>
        supabase
          .from("gar_desires")
          .insert({
            project_id: project.id,
            user_id: profile.id,
            text_content: body.text_content,
            embedding: embedding,
          })
          .select()
          .single(),
      );

      return result;
    } catch (error: any) {
      console.error("Error generating embedding:", error);
      return NextResponse.json(
        { error: "Failed to process desire text" },
        { status: 500 },
      );
    }
  },
  DesireRequestSchema,
  BurnRole.Participant,
);
