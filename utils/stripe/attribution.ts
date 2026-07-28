import { SaleKey } from "@/utils/stripe/types";

const TIMEZONE = "Europe/Stockholm";

function calendarYearIn(timeZone: string, date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric" }).format(date),
  );
}

/**
 * Fall is everything paid in the calendar year before the event; spring is the
 * event year itself. Evaluated in Europe/Stockholm.
 */
export function classifySale(paidAt: Date, eventEndDate: Date): SaleKey {
  const eventYear = calendarYearIn(TIMEZONE, eventEndDate);
  const paidYear = calendarYearIn(TIMEZONE, paidAt);
  return paidYear < eventYear ? "fall" : "spring";
}
