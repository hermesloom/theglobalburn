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

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

const formatRelativeDateTime = (date: Date) => {
  const now = new Date();

  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let relativeDay;

  if (diffDays === 0 && now.getDate() === date.getDate()) {
    relativeDay = 'Today'
  } else if (diffDays <= 1 && now.getDate() - date.getDate() === 1) {
    relativeDay = 'Yesterday';
  } else if (diffDays < 7) {
    relativeDay = `${diffDays === 1 ? "1 day" : `${diffDays} days`} ago`;
  }

  let weekday = date.toLocaleDateString('en-US', { weekday: 'long' });

  return `${weekday} at ${timeString} (${relativeDay})`;
}

function formatDOB(dobString: string, highlightUnderage: boolean = false): string {
  let dob = new Date(dobString);

  return(dob.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }));
}

const calculateAge = (birthDate: Date) => {
  let currentDate = new Date();

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
}

function isSameDay(date1: Date, date2: Date) {
  return (
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export { formatDate, formatRelativeDateTime, formatDOB, calculateAge, isSameDay };

