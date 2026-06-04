import { writable, get } from "svelte/store";
import type { DayKey, DayPlan, MealSlot, WeeklyPlan } from "../types";
import { DAYS } from "../types";
import { meals } from "../../data/meals";
import { nextDay } from "../utils/dayOrder";
import { shuffle } from "../utils/shuffle";

const STORAGE_KEY = "weekly-plan";

function migratePlan(raw: unknown): WeeklyPlan {
  if (!raw || typeof raw !== "object") return {};
  const record = raw as Record<string, unknown>;
  const sample = record[DAYS[0].key];
  if (typeof sample === "string") {
    const migrated: WeeklyPlan = {};
    for (const { key } of DAYS) {
      const mealId = record[key];
      if (typeof mealId === "string") {
        migrated[key] = { supper: mealId };
      }
    }
    return migrated;
  }
  return record as WeeklyPlan;
}

function loadPlan(): WeeklyPlan {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return migratePlan(JSON.parse(raw));
  } catch {
    return {};
  }
}

function savePlan(plan: WeeklyPlan): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
}

function dayPlan(plan: WeeklyPlan, day: DayKey): DayPlan {
  return plan[day] ?? {};
}

function createWeeklyPlanStore() {
  const { subscribe, set, update } = writable<WeeklyPlan>(loadPlan());

  subscribe((plan) => {
    savePlan(plan);
  });

  return {
    subscribe,
    setDay(day: DayKey, slot: MealSlot, mealId: string | undefined) {
      update((plan) => {
        const next = { ...plan };
        const current = { ...dayPlan(plan, day) };
        if (mealId) {
          current[slot] = mealId;
        } else {
          delete current[slot];
        }
        if (current.supper || current.diner) {
          next[day] = current;
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
        const next = { ...plan };
        for (const { key } of DAYS) {
          if (next[key]) {
            next[key] = { ...next[key] };
          }
        }

        const emptySuppers = DAYS.filter(({ key }) => !dayPlan(next, key).supper);
        if (emptySuppers.length > 0) {
          const usedIds = new Set<string>();
          for (const { key } of DAYS) {
            const day = dayPlan(next, key);
            if (day.supper) usedIds.add(day.supper);
            if (day.diner) usedIds.add(day.diner);
          }
          let pool = shuffle(meals.filter((m) => !usedIds.has(m.id)));
          if (pool.length < emptySuppers.length) {
            pool = [...pool, ...shuffle(meals)];
          }
          let index = 0;
          for (const { key } of emptySuppers) {
            const current = dayPlan(next, key);
            next[key] = { ...current, supper: pool[index].id };
            index++;
          }
        }

        for (const { key } of DAYS) {
          const current = dayPlan(next, key);
          if (current.diner) continue;
          const nextSupper = dayPlan(next, nextDay(key)).supper;
          if (!nextSupper) continue;
          next[key] = { ...current, diner: nextSupper };
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
