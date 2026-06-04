import type { DayKey, Meal } from "../types";

export function mealAllowedForSupper(meal: Meal, day: DayKey): boolean {
  return meal.supperDays.length > 0 && meal.supperDays.includes(day);
}

export function mealsEligibleForSupper(
  allMeals: Meal[],
  day: DayKey,
  usedIds: Set<string>,
): Meal[] {
  const eligible = allMeals.filter(
    (m) => mealAllowedForSupper(m, day) && !usedIds.has(m.id),
  );
  if (eligible.length > 0) return eligible;

  const allowed = allMeals.filter((m) => mealAllowedForSupper(m, day));
  if (allowed.length > 0) return allowed;

  const unused = allMeals.filter((m) => !usedIds.has(m.id));
  return unused.length > 0 ? unused : allMeals;
}
