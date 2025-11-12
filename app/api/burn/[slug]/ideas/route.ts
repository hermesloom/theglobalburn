import { requestWithMembership, query } from "@/app/api/_common/endpoints";
import { s } from "ajv-ts";

const CreateIdeaRequestSchema = s.object({
  title: s.string(),
  description: s.string().optional(),
});

// GET - Get all ideas for a project, sorted by vote count
export const GET = requestWithMembership(async (supabase, profile, request, body, project) => {
  const ideas = await query(() =>
    supabase
      .from("burn_ideas")
      .select("*")
      .eq("project_id", project!.id)
      .order("created_at", { ascending: false })
  );

  if (ideas.length === 0) {
    return { data: [] };
  }

  const ideaIds = ideas.map((idea: any) => idea.id);

  // Get user's votes
  const userVotes = await query(() =>
    supabase
      .from("burn_idea_votes")
      .select("idea_id")
      .in("idea_id", ideaIds)
      .eq("owner_id", profile.id)
  );

  const userVotedIdeaIds = new Set(userVotes.map((v: any) => v.idea_id));

  // Get vote counts for each idea using aggregation
  const voteCountsResult = await query(() =>
    supabase
      .from("burn_idea_votes")
      .select("idea_id")
      .in("idea_id", ideaIds)
  );

  const voteCountMap = new Map<string, number>();
  voteCountsResult.forEach((vote: any) => {
    voteCountMap.set(vote.idea_id, (voteCountMap.get(vote.idea_id) || 0) + 1);
  });

  // Add vote count and user vote status to each idea
  const ideasWithVotes = ideas.map((idea: any) => ({
    ...idea,
    vote_count: voteCountMap.get(idea.id) || 0,
    user_has_voted: userVotedIdeaIds.has(idea.id),
  }));

  // Sort by vote count (descending), then by created_at (newest first)
  ideasWithVotes.sort((a: any, b: any) => {
    if (b.vote_count !== a.vote_count) {
      return b.vote_count - a.vote_count;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return { data: ideasWithVotes };
});

// POST - Create a new idea (membership required)
export const POST = requestWithMembership<
  s.infer<typeof CreateIdeaRequestSchema>
>(
  async (supabase, profile, request, body, project) => {
    const idea = await query(() =>
      supabase
        .from("burn_ideas")
        .insert({
          project_id: project!.id,
          owner_id: profile.id,
          title: body.title.trim(),
          description: body.description?.trim() || null,
        })
        .select()
        .single()
    );

    return {
      ...idea,
      vote_count: 0,
      user_has_voted: false,
    };
  },
  CreateIdeaRequestSchema,
);

