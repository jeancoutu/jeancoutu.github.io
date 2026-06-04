import type { DayKey } from "../types";
import { DAYS } from "../types";

export function nextDay(day: DayKey): DayKey {
  const index = DAYS.findIndex((d) => d.key === day);
  return DAYS[(index + 1) % DAYS.length].key;
}

export function previousDay(day: DayKey): DayKey {
  const index = DAYS.findIndex((d) => d.key === day);
  return DAYS[(index - 1 + DAYS.length) % DAYS.length].key;
}
