import { writable, get } from "svelte/store";
import type { DayKey, WeeklyPlan } from "../types";
import { DAYS } from "../types";
import { meals } from "../../data/meals";
import { shuffle } from "../utils/shuffle";

const STORAGE_KEY = "weekly-plan";

function loadPlan(): WeeklyPlan {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as WeeklyPlan;
  } catch {
    return {};
  }
}

function savePlan(plan: WeeklyPlan): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
}

function createWeeklyPlanStore() {
  const { subscribe, set, update } = writable<WeeklyPlan>(loadPlan());

  subscribe((plan) => {
    savePlan(plan);
  });

  return {
    subscribe,
    setDay(day: DayKey, mealId: string | undefined) {
      update((plan) => {
        const next = { ...plan };
        if (mealId) {
          next[day] = mealId;
        } else {
          delete next[day];
        }
        return next;
      });
    },
    clearWeek() {
      set({});
    },
    autoFillWeek() {
      update((plan) => {
        const emptyDays = DAYS.filter((d) => !plan[d.key]);
        if (emptyDays.length === 0) return plan;

        const usedIds = new Set(
          DAYS.map((d) => plan[d.key]).filter((id): id is string => !!id),
        );
        let pool = shuffle(meals.filter((m) => !usedIds.has(m.id)));
        if (pool.length < emptyDays.length) {
          pool = [...pool, ...shuffle(meals)];
        }

        const next = { ...plan };
        let index = 0;
        for (const { key } of emptyDays) {
          next[key] = pool[index].id;
          index++;
        }
        return next;
      });
    },
    getSnapshot(): WeeklyPlan {
      return get({ subscribe });
    },
  };
}

export const weeklyPlan = createWeeklyPlanStore();
