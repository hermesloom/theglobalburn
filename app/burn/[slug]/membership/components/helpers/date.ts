const STOCKHOLM_TZ = "Europe/Stockholm";

function getStockholmParts(dateObj: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: STOCKHOLM_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(dateObj);
}

function formatDateWithTime(date: string | number | Date): string {
  if (!date) return "";
  const dateObj = new Date(date);
  const parts = getStockholmParts(dateObj);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")} CET/CEST`;
}

/**
 * Formats a date, showing time only if it's not midnight (00:00:00).
 *
 * @param date The date to format (string, number, or Date object)
 * @returns Formatted date string with or without time
 */
function formatDate(date: string | number | Date): string {
  if (!date) return "";

  const dateObj = new Date(date);
  const parts = getStockholmParts(dateObj);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "00";

  // Midnight UTC: date-only strings like "2026-06-15" parsed by JS
  // Midnight Stockholm: DB events where user entered midnight Stockholm time
  const isMidnightUTC = dateObj.getUTCHours() === 0 && dateObj.getUTCMinutes() === 0 && dateObj.getUTCSeconds() === 0;
  const isMidnightStockholm = get("hour") === "00" && get("minute") === "00" && get("second") === "00";

  if (isMidnightUTC || isMidnightStockholm) {
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  return formatDateWithTime(dateObj);
}

const formatRelativeDateTime = (date: Date) => {
  const now = new Date();

  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );

  const timeString = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  let relativeDay;

  if (diffDays === 0 && now.getDate() === date.getDate()) {
    relativeDay = "Today";
  } else if (diffDays <= 1 && now.getDate() - date.getDate() === 1) {
    relativeDay = "Yesterday";
  } else if (diffDays < 7) {
    relativeDay = `${diffDays === 1 ? "1 day" : `${diffDays} days`} ago`;
  }

  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });

  return `${weekday} at ${timeString} (${relativeDay})`;
};

function formatDOB(
  dobString: string,
  _highlightUnderage: boolean = false,
): string {
  const dob = new Date(dobString);

  return dob.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const calculateAge = (birthDate: Date, referenceDate?: Date) => {
  const currentDate = referenceDate || new Date();

  let age = currentDate.getFullYear() - birthDate.getFullYear();

  // Check if the birthday has occurred yet this year
  const hasHadBirthdayThisYear =
    currentDate.getMonth() > birthDate.getMonth() ||
    (currentDate.getMonth() === birthDate.getMonth() &&
      currentDate.getDate() >= birthDate.getDate());

  if (!hasHadBirthdayThisYear) {
    age--;
  }

  return age;
};

function isSameDay(date1: Date, date2: Date) {
  return (
    date1.getMonth() === date2.getMonth() && date1.getDate() === date2.getDate()
  );
}

/**
 * Formats a date range like "July 21 – July 27, 2025"
 *
 * @param startDate The start date
 * @param endDate The end date
 * @returns Formatted date range string
 */
function formatDateRange(startDate: Date, endDate: Date): string {
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: STOCKHOLM_TZ, ...opts }).format(d);

  const startMonth = fmt(startDate, { month: "long" });
  const startDay = Number(fmt(startDate, { day: "numeric" }));
  const startYear = Number(fmt(startDate, { year: "numeric" }));
  const endMonth = fmt(endDate, { month: "long" });
  const endDay = Number(fmt(endDate, { day: "numeric" }));
  const year = Number(fmt(endDate, { year: "numeric" }));
  const startMonthNum = Number(fmt(startDate, { month: "numeric" }));
  const endMonthNum = Number(fmt(endDate, { month: "numeric" }));

  if (startMonthNum === endMonthNum && startYear === year) {
    return `${startMonth} ${startDay} – ${endDay}, ${year}`;
  }
  if (startYear === year) {
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${year}`;
}

export {
  formatDate,
  formatDateWithTime,
  formatRelativeDateTime,
  formatDOB,
  calculateAge,
  isSameDay,
  formatDateRange,
};
