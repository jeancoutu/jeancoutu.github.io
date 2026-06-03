import { derived, writable } from "svelte/store";
import { meals as allMeals } from "../../data/meals";
import type { DurationTag } from "../types";

export const mealSearch = writable("");
export const durationFilter = writable<DurationTag | "all">("all");

export const filteredMeals = derived(
  [mealSearch, durationFilter],
  ([$search, $duration]) => {
    const query = $search.trim().toLowerCase();
    return allMeals.filter((meal) => {
      const matchesSearch =
        !query || meal.name.toLowerCase().includes(query);
      const matchesDuration =
        $duration === "all" || meal.duration === $duration;
      return matchesSearch && matchesDuration;
    });
  },
);

export function getMealById(id: string) {
  return allMeals.find((m) => m.id === id);
}
