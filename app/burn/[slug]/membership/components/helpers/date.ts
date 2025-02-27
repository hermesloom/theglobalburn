/**
 * Formats a date to YYYY-MM-DD HH:MM:SS format in the local timezone.
 *
 * @param date The date to format (string, number, or Date object)
 * @returns Formatted date string
 */
export function formatDate(date: string | number | Date): string {
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
