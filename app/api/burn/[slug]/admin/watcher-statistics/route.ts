import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole } from "@/utils/types";

function calculateAge(birthDateStr: string): number | null {
  if (!birthDateStr) return null;
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export const GET = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const memberships = await query(() =>
      supabase
        .from("burn_memberships")
        .select("birthdate, metadata->children, metadata->pets")
        .eq("project_id", project!.id)
    );

    const memberAgeMap: Record<number, number> = {};
    const childAgeMap: Record<number, number> = {};
    let childrenCount = 0;
    let dogs = 0;
    let cats = 0;
    let otherPets = 0;

    for (const m of memberships) {
      const memberAge = calculateAge(m.birthdate);
      if (memberAge !== null) {
        memberAgeMap[memberAge] = (memberAgeMap[memberAge] || 0) + 1;
      }

      const children = (m.children as any[]) || [];
      childrenCount += children.length;
      for (const child of children) {
        const childAge = calculateAge(child.dob);
        if (childAge !== null) {
          childAgeMap[childAge] = (childAgeMap[childAge] || 0) + 1;
        }
      }

      const pets = (m.pets as any[]) || [];
      for (const pet of pets) {
        const type = (pet.type || "").toLowerCase();
        if (type === "dog") dogs++;
        else if (type === "cat") cats++;
        else otherPets++;
      }
    }

    const toDistribution = (map: Record<number, number>) =>
      Object.entries(map)
        .map(([age, count]) => ({ age: parseInt(age), count }))
        .sort((a, b) => a.age - b.age);

    return {
      memberCount: memberships.length,
      childrenCount,
      memberAgeDistribution: toDistribution(memberAgeMap),
      childrenAgeDistribution: toDistribution(childAgeMap),
      petCounts: { dogs, cats, other: otherPets },
    };
  },
  undefined,
  [BurnRole.MembershipManager, BurnRole.ThresholdWatcher],
);
