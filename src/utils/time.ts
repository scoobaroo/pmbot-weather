/**
 * Date and timezone helpers.
 */

/** Format a Date as YYYY-MM-DD in a given timezone. */
export function formatDateInTz(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return `${year}-${month}-${day}`;
}

/** Get today's date string in a timezone. */
export function todayInTz(timezone: string): string {
  return formatDateInTz(new Date(), timezone);
}

/** Get tomorrow's date string in a timezone. */
export function tomorrowInTz(timezone: string): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDateInTz(d, timezone);
}

/** Parse "February 25" / "Feb 25" / "2/25" into YYYY-MM-DD for the current or next occurrence. */
export function parseMarketDate(dateStr: string): string | null {
  const now = new Date();
  const currentYear = now.getFullYear();

  // Try "Month Day" format
  const monthDayMatch = dateStr.match(
    /(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i
  );
  if (monthDayMatch) {
    const parsed = new Date(`${dateStr}, ${currentYear}`);
    if (!isNaN(parsed.getTime())) {
      // Allow dates up to 7 days in the past (markets resolve shortly after)
      // Only bump to next year if more than 7 days ago
      const msAgo = now.getTime() - parsed.getTime();
      if (msAgo > 7 * 86_400_000) {
        parsed.setFullYear(currentYear + 1);
      }
      return formatDateLocal(parsed);
    }
  }

  // Try M/D format
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10) - 1;
    const day = parseInt(slashMatch[2], 10);
    const parsed = new Date(currentYear, month, day);
    const msAgo = now.getTime() - parsed.getTime();
    if (msAgo > 7 * 86_400_000) parsed.setFullYear(currentYear + 1);
    return formatDateLocal(parsed);
  }

  // Try YYYY-MM-DD
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return dateStr;

  return null;
}

function formatDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Check if a date string is within the next N days. */
export function isWithinDays(dateStr: string, days: number): boolean {
  const target = new Date(dateStr + "T00:00:00Z");
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return diff >= -86_400_000 && diff <= days * 86_400_000;
}
