export function formatDuration(milliseconds: number): string {
  const minutes = Math.floor((milliseconds / (1000 * 60)) % 60);
  const seconds = Math.floor((milliseconds / 1000) % 60);
  const ms = Math.floor(milliseconds % 1000);

  return `${minutes > 0 ? minutes + "m" : ""}${seconds > 0 ? seconds + "s" : ""}${ms}ms`;
}
