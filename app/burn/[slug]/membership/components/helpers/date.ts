/**
 * Formats a date to YYYY-MM-DD HH:MM:SS format in the local timezone.
 *
 * @param date The date to format (string, number, or Date object)
 * @returns Formatted date string
 */
function formatDate(date: string | number | Date): string {
  if (!date) return "";

  const dateObj = new Date(date);

  // Format date components
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  const hours = String(dateObj.getHours()).padStart(2, "0");
  const minutes = String(dateObj.getMinutes()).padStart(2, "0");
  const seconds = String(dateObj.getSeconds()).padStart(2, "0");

  // Get timezone abbreviation
  const timeZoneAbbr =
    new Intl.DateTimeFormat("en-US", {
      timeZoneName: "shortGeneric",
    })
      .formatToParts(dateObj)
      .find((part) => part.type === "timeZoneName")?.value || "";

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${timeZoneAbbr}`;
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

const calculateAge = (birthDate: Date) => {
  const currentDate = new Date();

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
  const startMonth = startDate.toLocaleDateString("en-US", { month: "long" });
  const startDay = startDate.getDate();
  const endMonth = endDate.toLocaleDateString("en-US", { month: "long" });
  const endDay = endDate.getDate();
  const year = endDate.getFullYear();

  // If same month, format as "Month Day1 – Day2, Year"
  if (startDate.getMonth() === endDate.getMonth() && startDate.getFullYear() === endDate.getFullYear()) {
    return `${startMonth} ${startDay} – ${endDay}, ${year}`;
  }

  // If different months but same year, format as "Month1 Day1 – Month2 Day2, Year"
  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
  }

  // If different years, format as "Month1 Day1, Year1 – Month2 Day2, Year2"
  const startYear = startDate.getFullYear();
  return `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${year}`;
}

export {
  formatDate,
  formatRelativeDateTime,
  formatDOB,
  calculateAge,
  isSameDay,
  formatDateRange,
};
