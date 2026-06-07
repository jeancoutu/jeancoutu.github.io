import { writable, get, derived } from "svelte/store";
import type { DayKey, DayPlan, MealSlot, WeeklyPlan } from "../types";
import { DAYS } from "../types";
import { meals } from "../../data/meals";
import { previousDay } from "../utils/dayOrder";
import { mealsEligibleForSupper } from "../utils/supperDays";
import { shuffle } from "../utils/shuffle";
import { getWeekSaturday, toWeekKey } from "../utils/weekDates";

const STORAGE_KEY = "weekly-plans";
const LEGACY_STORAGE_KEY = "weekly-plan";

interface StoredPlans {
  selectedWeek: string;
  plans: Record<string, WeeklyPlan>;
}

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

function loadStoredPlans(): StoredPlans {
  const defaultWeek = toWeekKey(getWeekSaturday());

  if (typeof localStorage === "undefined") {
    return { selectedWeek: defaultWeek, plans: {} };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredPlans;
      return {
        selectedWeek: parsed.selectedWeek ?? defaultWeek,
        plans: Object.fromEntries(
          Object.entries(parsed.plans ?? {}).map(([key, plan]) => [
            key,
            migratePlan(plan),
          ]),
        ),
      };
    }
  } catch {
    // fall through to legacy migration
  }

  try {
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const plan = migratePlan(JSON.parse(legacyRaw));
      const stored: StoredPlans = {
        selectedWeek: defaultWeek,
        plans: Object.keys(plan).length > 0 ? { [defaultWeek]: plan } : {},
      };
      saveStoredPlans(stored);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return stored;
    }
  } catch {
    // ignore
  }

  return { selectedWeek: defaultWeek, plans: {} };
}

function saveStoredPlans(data: StoredPlans): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function dayPlan(plan: WeeklyPlan, day: DayKey): DayPlan {
  return plan[day] ?? {};
}

function createWeeklyPlanStore(
  selectedWeek: ReturnType<typeof writable<string>>,
  plans: ReturnType<typeof writable<Record<string, WeeklyPlan>>>,
) {

  const currentPlan = derived([selectedWeek, plans], ([week, allPlans]) => {
    return allPlans[week] ?? {};
  });

  function persist() {
    saveStoredPlans({
      selectedWeek: get(selectedWeek),
      plans: get(plans),
    });
  }

  selectedWeek.subscribe(() => persist());
  plans.subscribe(() => persist());

  function updateCurrentPlan(updater: (plan: WeeklyPlan) => WeeklyPlan) {
    const week = get(selectedWeek);
    plans.update((all) => {
      const current = all[week] ?? {};
      const next = updater(current);
      if (Object.keys(next).length === 0) {
        const { [week]: _, ...rest } = all;
        return rest;
      }
      return { ...all, [week]: next };
    });
  }

  return {
    subscribe: currentPlan.subscribe,
    setSelectedWeek(weekKey: string) {
      selectedWeek.set(weekKey);
    },
    setDay(day: DayKey, slot: MealSlot, mealId: string | undefined) {
      updateCurrentPlan((plan) => {
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
      updateCurrentPlan(() => ({}));
    },
    importPlan(plan: WeeklyPlan, weekStart?: string) {
      const week = weekStart ?? get(selectedWeek);
      const migrated = migratePlan(plan);
      plans.update((all) => {
        if (Object.keys(migrated).length === 0) {
          const { [week]: _, ...rest } = all;
          return rest;
        }
        return { ...all, [week]: migrated };
      });
      selectedWeek.set(week);
    },
    autoFillWeek() {
      updateCurrentPlan((plan) => {
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
          for (const { key } of emptySuppers) {
            const candidates = shuffle(mealsEligibleForSupper(meals, key, usedIds));
            const pick = candidates[0];
            const current = dayPlan(next, key);
            next[key] = { ...current, supper: pick.id };
            usedIds.add(pick.id);
          }
        }

        for (const { key } of DAYS) {
          const current = { ...dayPlan(next, key) };

          if (key === "saturday") {
            delete current.diner;
            if (current.supper) next[key] = current;
            else delete next[key];
            continue;
          }

          if (!current.diner) {
            const prevSupper = dayPlan(next, previousDay(key)).supper;
            if (prevSupper) current.diner = prevSupper;
          }

          if (current.supper || current.diner) next[key] = current;
          else delete next[key];
        }

        return next;
      });
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

const initial = loadStoredPlans();
export const selectedWeek = writable(initial.selectedWeek);
const plans = writable<Record<string, WeeklyPlan>>(initial.plans);
export const allPlans = { subscribe: plans.subscribe };
export const weeklyPlan = createWeeklyPlanStore(selectedWeek, plans);
