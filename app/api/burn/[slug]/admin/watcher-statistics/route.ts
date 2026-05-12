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
        .select("id, first_name, last_name, birthdate, metadata->children, metadata->pets")
        .eq("project_id", project!.id)
    );

    const memberAgeMap: Record<number, number> = {};
    const childAgeMap: Record<number, number> = {};
    let childrenCount = 0;
    let dogs = 0;
    let cats = 0;
    let otherPets = 0;

    const youngMembers: { id: string; first_name: string; last_name: string; birthdate: string; age: number }[] = [];
    const oldChildren: { member: { id: string; first_name: string; last_name: string }; child: { first_name: string; last_name: string; dob: string; age: number } }[] = [];

    for (const m of memberships) {
      const memberAge = calculateAge(m.birthdate);
      if (memberAge !== null) {
        memberAgeMap[memberAge] = (memberAgeMap[memberAge] || 0) + 1;
        if (memberAge <= 13) {
          youngMembers.push({
            id: m.id,
            first_name: m.first_name,
            last_name: m.last_name,
            birthdate: m.birthdate,
            age: memberAge,
          });
        }
      }

      const children = (m.children as any[]) || [];
      childrenCount += children.length;
      for (const child of children) {
        const childAge = calculateAge(child.dob);
        if (childAge !== null) {
          childAgeMap[childAge] = (childAgeMap[childAge] || 0) + 1;
          if (childAge >= 14) {
            oldChildren.push({
              member: { id: m.id, first_name: m.first_name, last_name: m.last_name },
              child: { first_name: child.first_name, last_name: child.last_name, dob: child.dob, age: childAge },
            });
          }
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
      anomalies: {
        youngMembers: youngMembers.sort((a, b) => a.age - b.age),
        oldChildren: oldChildren.sort((a, b) => a.child.age - b.child.age),
      },
    };
  },
  undefined,
  [BurnRole.MembershipManager, BurnRole.ThresholdWatcher],
);
