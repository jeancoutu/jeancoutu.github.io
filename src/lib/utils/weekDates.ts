/** Saturday that starts the week containing `date` (week runs Sat–Fri). */
export function getWeekSaturday(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const daysSinceSaturday = (d.getDay() + 1) % 7;
  d.setDate(d.getDate() - daysSinceSaturday);
  return d;
}

/** ISO local date string (YYYY-MM-DD) for a week key. */
export function toWeekKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseWeekKey(key: string): Date {
  const parts = key.split("-").map(Number);
  const [y, m, d] = [parts[0]!, parts[1]!, parts[2]!];
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addWeeks(saturday: Date, delta: number): Date {
  const d = new Date(saturday);
  d.setDate(d.getDate() + delta * 7);
  return d;
}

/** Human-readable range for a Sat–Fri week. */
export function formatWeekRange(weekStartKey: string, locale = "en"): string {
  const start = parseWeekKey(weekStartKey);
  const end = addWeeks(start, 1);
  end.setDate(end.getDate() - 1);

  const shortDate = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  });

  const shortDateWithYear = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = sameYear
    ? shortDate.format(start)
    : shortDateWithYear.format(start);
  const endLabel = shortDateWithYear.format(end);
  return `${startLabel} – ${endLabel}`;
}

export function isCurrentWeek(weekStartKey: string): boolean {
  return weekStartKey === toWeekKey(getWeekSaturday());
}
