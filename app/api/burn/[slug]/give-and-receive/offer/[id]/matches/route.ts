import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { NextResponse } from "next/server";
import { BurnRole, GiveAndReceiveDesire } from "@/utils/types";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const GET = requestWithProject(
  async (supabase, profile, request, body, project) => {
    // Check if user has an active membership
    if (!project?.membership) {
      return NextResponse.json(
        { error: "You need an active membership to use this feature" },
        { status: 403 },
      );
    }

    // Get the offer ID from the path parameter
    const segments = request.nextUrl.pathname.split("/");
    const offerId = segments[segments.length - 2]; // -2 because the last segment is "matches"

    // Get the offer
    const offer = await query(() =>
      supabase.from("gar_offers").select("*").eq("id", offerId).single(),
    );

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    try {
      // Generate the complementary desire using OpenAI
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "user",
            content: `Formulate the following offer (i.e. what someone wants to give) as its counterpart, i.e. the corresponding desire (i.e. what the receiver would ask for to be matched perfectly to the offerer). Output nothing but that desire.\n\n${offer.text_content}`,
          },
        ],
        temperature: 0.7,
      });

      const complementaryDesire = completion.choices[0].message.content!.trim();

      // Generate embedding for the complementary desire
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: complementaryDesire,
      });

      const embedding = embeddingResponse.data[0].embedding;

      // Find similar desires using direct vector similarity query
      const similarDesires = await query(() =>
        supabase
          .from("gar_desires")
          .select("*")
          .eq("project_id", project.id)
          .filter("user_id", "neq", profile.id)
          .order(`embedding <-> '${JSON.stringify(embedding)}'::vector`)
          .limit(50),
      );

      // Prepare the result with user information
      const enrichedMatches = await Promise.all(
        similarDesires.map(async (desire: GiveAndReceiveDesire) => {
          // Always query user info since it's not part of the GiveAndReceiveDesire type
          const userResult = await query(() =>
            supabase
              .from("profiles")
              .select("email")
              .eq("id", desire.user_id)
              .single(),
          );

          const membershipResult = await query(() =>
            supabase
              .from("burn_memberships")
              .select("first_name, last_name")
              .eq("project_id", project.id)
              .eq("owner_id", desire.user_id)
              .single(),
          );

          return {
            id: desire.id,
            text_content: desire.text_content,
            created_at: desire.created_at,
            user: {
              email: userResult?.email,
              first_name: membershipResult?.first_name,
              last_name: membershipResult?.last_name,
            },
          };
        }),
      );

      return {
        complementary_desire: complementaryDesire,
        matches: enrichedMatches,
      };
    } catch (error: any) {
      console.error("Error finding matches:", error);
      return NextResponse.json(
        { error: "Failed to find matches" },
        { status: 500 },
      );
    }
  },
  undefined,
  BurnRole.Participant,
);
