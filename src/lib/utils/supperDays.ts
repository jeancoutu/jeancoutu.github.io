import type { DayKey, Meal } from "../types";
import { DAYS } from "../types";

export function mealAllowedForSupper(meal: Meal, day: DayKey): boolean {
  return meal.supperDays.length > 0 && meal.supperDays.includes(day);
}

/**
 * Tag gap = number of days strictly between two suppers (adjacent days = gap 0).
 * A meal conflicts with a placed tag when it shares a tag and the gap is below minGap.
 */
function hasTagConflict(
  meal: Meal,
  day: DayKey,
  placedTagsByDay: Map<DayKey, Set<string>>,
  minGap: number,
): boolean {
  if (meal.tags.length === 0) return false;
  const dayIndex = DAYS.findIndex((d) => d.key === day);
  for (const [otherDay, tags] of placedTagsByDay) {
    if (otherDay === day) continue;
    if (!meal.tags.some((t) => tags.has(t))) continue;
    const otherIndex = DAYS.findIndex((d) => d.key === otherDay);
    const gap = Math.abs(dayIndex - otherIndex) - 1;
    if (gap < minGap) return true;
  }
  return false;
}

export function mealsEligibleForSupper(
  allMeals: Meal[],
  day: DayKey,
  usedIds: Set<string>,
  previousWeekIds: Set<string> = new Set(),
  placedTagsByDay: Map<DayKey, Set<string>> = new Map(),
): Meal[] {
  const dayEligible = (m: Meal) => mealAllowedForSupper(m, day) && !usedIds.has(m.id);

  // T1: fresh (not used this week, not last week) + tag gap >= 2
  const t1 = allMeals.filter(
    (m) =>
      dayEligible(m) &&
      !previousWeekIds.has(m.id) &&
      !hasTagConflict(m, day, placedTagsByDay, 2),
  );
  if (t1.length > 0) return t1;

  // T2: drop last-week freshness, keep tag gap >= 2
  const t2 = allMeals.filter((m) => dayEligible(m) && !hasTagConflict(m, day, placedTagsByDay, 2));
  if (t2.length > 0) return t2;

  // T3: relax tag gap to >= 1
  const t3 = allMeals.filter((m) => dayEligible(m) && !hasTagConflict(m, day, placedTagsByDay, 1));
  if (t3.length > 0) return t3;

  // T4: drop the tag constraint entirely
  const eligible = allMeals.filter(dayEligible);
  if (eligible.length > 0) return eligible;

  const allowed = allMeals.filter((m) => mealAllowedForSupper(m, day));
  if (allowed.length > 0) return allowed;

  const unused = allMeals.filter((m) => !usedIds.has(m.id));
  return unused.length > 0 ? unused : allMeals;
}
