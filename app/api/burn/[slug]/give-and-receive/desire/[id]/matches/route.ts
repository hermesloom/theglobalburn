import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { NextResponse } from "next/server";
import { BurnRole, GiveAndReceiveOffer } from "@/utils/types";
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

    // Get the desire ID from the path parameter
    const segments = request.nextUrl.pathname.split("/");
    const desireId = segments[segments.length - 2]; // -2 because the last segment is "matches"

    // Get the desire
    const desire = await query(() =>
      supabase.from("gar_desires").select("*").eq("id", desireId).single(),
    );

    if (!desire) {
      return NextResponse.json({ error: "Desire not found" }, { status: 404 });
    }

    try {
      // Generate the complementary offer using OpenAI
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "user",
            content: `Formulate the following desire (i.e. what someone is asking for) as its counterpart, i.e. the corresponding offer (i.e. what someone would give to be matched perfectly to the asker). Output nothing but that offer.\n\n${desire.text_content}`,
          },
        ],
        temperature: 0.7,
      });

      const complementaryOffer = completion.choices[0].message.content!.trim();

      // Generate embedding for the complementary offer
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: complementaryOffer,
      });

      const embedding = embeddingResponse.data[0].embedding;

      // Find similar offers using direct vector similarity query
      const similarOffers = await query(() =>
        supabase
          .from("gar_offers")
          .select("*")
          .eq("project_id", project.id)
          .filter("user_id", "neq", profile.id)
          .order(`embedding <-> '${JSON.stringify(embedding)}'::vector`)
          .limit(50),
      );

      // Prepare the result with user information
      const enrichedMatches = await Promise.all(
        similarOffers.map(async (offer: GiveAndReceiveOffer) => {
          // Always query user info since it's not part of the GiveAndReceiveOffer type
          const userResult = await query(() =>
            supabase
              .from("profiles")
              .select("email")
              .eq("id", offer.user_id)
              .single(),
          );

          const membershipResult = await query(() =>
            supabase
              .from("burn_memberships")
              .select("first_name, last_name")
              .eq("project_id", project.id)
              .eq("owner_id", offer.user_id)
              .single(),
          );

          return {
            id: offer.id,
            text_content: offer.text_content,
            created_at: offer.created_at,
            user: {
              email: userResult?.email,
              first_name: membershipResult?.first_name,
              last_name: membershipResult?.last_name,
            },
          };
        }),
      );

      return {
        complementary_offer: complementaryOffer,
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
