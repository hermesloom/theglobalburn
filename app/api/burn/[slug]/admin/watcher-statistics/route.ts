import { requestWithProject, query } from "@/app/api/_common/endpoints";
import { BurnRole, Project } from "@/utils/types";
import { calculateAge } from "@/app/burn/[slug]/membership/components/helpers/date";

const EVENT_START_DATES: Record<number, string> = {
  2026: "2026-07-18",
  2027: "2027-07-24",
};

function getEventStartDate(project: Project): Date | null {
  const yearSource =
    project.burn_config.event_end_date ||
    project.burn_config.open_sale_general_starting_at;
  if (!yearSource) return null;
  const year = new Date(yearSource).getFullYear();
  const dateStr = EVENT_START_DATES[year];
  return dateStr ? new Date(dateStr) : null;
}

function ageAt(birthDateStr: string, referenceDate: Date | null): number | null {
  if (!birthDateStr) return null;
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return null;
  return calculateAge(birth, referenceDate ?? undefined);
}

export const GET = requestWithProject(
  async (supabase, profile, request, body, project) => {
    const memberships = await query(() =>
      supabase
        .from("burn_memberships")
        .select("id, first_name, last_name, birthdate, metadata->children, metadata->pets, metadata->car_registration")
        .eq("project_id", project!.id)
    );

    const eventStart = getEventStartDate(project!);

    const memberAgeMap: Record<number, number> = {};
    const childAgeMap: Record<number, number> = {};
    let childrenCount = 0;
    let sleeperVehicleCount = 0;
    let dogs = 0;
    let cats = 0;
    let otherPets = 0;

    type MemberEntry = { id: string; first_name: string; last_name: string; birthdate: string; currentAge: number; eventAge: number | null };
    type ChildInfo = { first_name: string; last_name: string; dob: string; currentAge: number; eventAge: number | null };
    type GroupedOldChild = { member: { id: string; first_name: string; last_name: string }; children: ChildInfo[] };

    const youngMembers: MemberEntry[] = [];
    const teenMembers: MemberEntry[] = [];
    const oldChildrenMap: Record<string, GroupedOldChild> = {};

    for (const m of memberships) {
      const currentAge = ageAt(m.birthdate, null);
      const eventAge = ageAt(m.birthdate, eventStart);
      if (currentAge !== null) {
        const distAge = eventAge ?? currentAge;
        memberAgeMap[distAge] = (memberAgeMap[distAge] || 0) + 1;
        const entry: MemberEntry = {
          id: m.id,
          first_name: m.first_name,
          last_name: m.last_name,
          birthdate: m.birthdate,
          currentAge,
          eventAge,
        };
        if (currentAge <= 13) {
          youngMembers.push(entry);
        } else if (currentAge <= 17) {
          teenMembers.push(entry);
        }
      }

      const children = (m.children as any[]) || [];
      childrenCount += children.length;
      for (const child of children) {
        const currentAge = ageAt(child.dob, null);
        const childEventAge = ageAt(child.dob, eventStart);
        if (currentAge !== null) {
          const distAge = childEventAge ?? currentAge;
          childAgeMap[distAge] = (childAgeMap[distAge] || 0) + 1;
          if (currentAge >= 14) {
            if (!oldChildrenMap[m.id]) {
              oldChildrenMap[m.id] = { member: { id: m.id, first_name: m.first_name, last_name: m.last_name }, children: [] };
            }
            oldChildrenMap[m.id].children.push({
              first_name: child.first_name,
              last_name: child.last_name,
              dob: child.dob,
              currentAge,
              eventAge: childEventAge,
            });
          }
        }
      }

      const car = m.car_registration as any;
      if (car && (car.phone_number || car.alt_contact || car.camp_or_area || car.registration_plate)) {
        sleeperVehicleCount++;
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
      sleeperVehicleCount,
      childrenCount,
      memberAgeDistribution: toDistribution(memberAgeMap),
      childrenAgeDistribution: toDistribution(childAgeMap),
      petCounts: { dogs, cats, other: otherPets },
      eventStartDate: eventStart ? eventStart.toISOString().slice(0, 10) : null,
      anomalies: {
        youngMembers: youngMembers.sort((a, b) => a.currentAge - b.currentAge),
        teenMembers: teenMembers.sort((a, b) => a.currentAge - b.currentAge),
        oldChildren: Object.values(oldChildrenMap).sort((a, b) =>
          Math.min(...a.children.map((c) => c.currentAge)) - Math.min(...b.children.map((c) => c.currentAge))
        ),
      },
    };
  },
  undefined,
  [BurnRole.MembershipManager, BurnRole.ThresholdWatcher],
);
