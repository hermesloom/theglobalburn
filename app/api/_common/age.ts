import { Project } from "@/utils/types";
import { calculateAge } from "@/app/burn/[slug]/membership/components/helpers/date";

export const EVENT_START_DATES: Record<number, string> = {
  2026: "2026-07-18",
  2027: "2027-07-24",
};

export function getEventStartDate(project: Project): Date | null {
  const yearSource =
    project.burn_config.event_end_date ||
    project.burn_config.open_sale_general_starting_at;
  if (!yearSource) return null;
  const year = new Date(yearSource).getFullYear();
  const dateStr = EVENT_START_DATES[year];
  return dateStr ? new Date(dateStr) : null;
}

export function ageAt(
  birthDateStr: string,
  referenceDate: Date | null,
): number | null {
  if (!birthDateStr) return null;
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return null;
  return calculateAge(birth, referenceDate ?? undefined);
}

/**
 * Turns an age -> count map into a sorted array with every integer age between
 * the minimum and maximum present, so ages nobody has render as empty columns
 * rather than collapsing the distribution.
 */
export function toAgeDistribution(
  map: Record<number, number>,
): { age: number; count: number }[] {
  const ages = Object.keys(map).map((age) => parseInt(age));
  if (ages.length === 0) return [];

  const min = Math.min(...ages);
  const max = Math.max(...ages);

  return Array.from({ length: max - min + 1 }, (_, i) => ({
    age: min + i,
    count: map[min + i] ?? 0,
  }));
}
