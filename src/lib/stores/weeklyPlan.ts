import { writable, get, derived } from "svelte/store";
import type { DayKey, MealSlot, WeeklyPlan } from "../types";
import { DAYS } from "../types";
import { allMeals } from "./meals";
import { previousDay } from "../utils/dayOrder";
import { mealsEligibleForSupper } from "../utils/supperDays";
import { shuffle } from "../utils/shuffle";
import { getWeekSaturday, toWeekKey } from "../utils/weekDates";
import { session } from "./auth";
import {
  getWeeklyPlan,
  setMealSlot,
  clearPlan,
} from "../api/plan";

const defaultWeek = toWeekKey(getWeekSaturday());

export const selectedWeek = writable<string>(defaultWeek);
const plans = writable<Record<string, WeeklyPlan>>({});

const currentPlan = derived([selectedWeek, plans], ([week, allPlans]) => {
  return allPlans[week] ?? {};
});

export const allPlans = { subscribe: plans.subscribe };

async function loadWeek(week: string): Promise<void> {
  const plan = await getWeeklyPlan(week);
  plans.update((all) => ({ ...all, [week]: plan }));
}

session.subscribe(async ($session) => {
  if ($session) {
    await loadWeek(get(selectedWeek));
  } else {
    plans.set({});
    selectedWeek.set(toWeekKey(getWeekSaturday()));
  }
});

function createWeeklyPlanStore() {
  async function updateSlot(
    day: DayKey,
    slot: MealSlot,
    mealId: string | undefined,
  ) {
    const week = get(selectedWeek);
    const id = mealId ?? null;
    await setMealSlot(week, day, slot, id);
    plans.update((all) => {
      const current = { ...(all[week] ?? {}) };
      const dayEntry = { ...(current[day] ?? {}) };
      if (id) {
        dayEntry[slot] = id;
      } else {
        delete dayEntry[slot];
      }
      if (dayEntry.supper || dayEntry.diner) {
        current[day] = dayEntry;
      } else {
        delete current[day];
      }
      return { ...all, [week]: current };
    });
  }

  return {
    subscribe: currentPlan.subscribe,
    async setSelectedWeek(weekKey: string) {
      selectedWeek.set(weekKey);
      const cached = get(plans)[weekKey];
      if (!cached) {
        await loadWeek(weekKey);
      }
    },
    async setDay(day: DayKey, slot: MealSlot, mealId: string | undefined) {
      await updateSlot(day, slot, mealId);
    },
    async clearWeek() {
      const week = get(selectedWeek);
      await clearPlan(week);
      plans.update((all) => {
        const { [week]: _, ...rest } = all;
        return rest;
      });
    },
    async importPlan(plan: WeeklyPlan, weekStart?: string) {
      const week = weekStart ?? get(selectedWeek);
      selectedWeek.set(week);

      await clearPlan(week);

      for (const [dayKey, dayPlan] of Object.entries(plan)) {
        if (!dayPlan) continue;
        const day = dayKey as DayKey;
        if (dayPlan.supper) await setMealSlot(week, day, "supper", dayPlan.supper);
        if (dayPlan.diner) await setMealSlot(week, day, "diner", dayPlan.diner);
      }

      plans.update((all) => ({ ...all, [week]: plan }));
    },
    async autoFillWeek() {
      const week = get(selectedWeek);
      const current = { ...(get(plans)[week] ?? {}) };

      for (const { key } of DAYS) {
        if (current[key]) current[key] = { ...current[key] };
      }

      const emptySuppers = DAYS.filter(({ key }) => !current[key]?.supper);
      if (emptySuppers.length > 0) {
        const usedIds = new Set<string>();
        for (const { key } of DAYS) {
          const day = current[key];
          if (day?.supper) usedIds.add(day.supper);
          if (day?.diner) usedIds.add(day.diner);
        }
        for (const { key } of emptySuppers) {
          const candidates = shuffle(mealsEligibleForSupper(get(allMeals), key, usedIds));
          const pick = candidates[0];
          const entry = { ...(current[key] ?? {}) };
          entry.supper = pick.id;
          current[key] = entry;
          usedIds.add(pick.id);
        }
      }

      for (const { key } of DAYS) {
        const entry = { ...(current[key] ?? {}) };

        if (key === "saturday") {
          delete entry.diner;
          if (entry.supper) current[key] = entry;
          else delete current[key];
          continue;
        }

        if (!entry.diner) {
          const prevKey = previousDay(key);
          const prevSupper = current[prevKey]?.supper;
          if (prevSupper) entry.diner = prevSupper;
        }

        if (entry.supper || entry.diner) current[key] = entry;
        else delete current[key];
      }

      plans.update((all) => ({ ...all, [week]: current }));

      (async () => {
        await Promise.all(
          DAYS.map(({ key }) => setMealSlot(week, key, "supper", current[key]?.supper ?? null))
        );
        await Promise.all(
          DAYS.filter(({ key }) => key !== "saturday").map(({ key }) =>
            setMealSlot(week, key, "diner", current[key]?.diner ?? null)
          )
        );
      })();
    },
    getSnapshot(): WeeklyPlan {
      return get(currentPlan);
    },
    getSelectedWeek(): string {
      return get(selectedWeek);
    },
    getAllPlans(): Record<string, WeeklyPlan> {
      return get(plans);
    },
  };
}

export const weeklyPlan = createWeeklyPlanStore();
