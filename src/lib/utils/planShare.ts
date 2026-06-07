import type { DayKey, DayPlan, MealSlot, WeeklyPlan } from "../types";
import { DAYS } from "../types";
import { meals } from "../../data/meals";
import { appPath } from "./paths";

/** Wire format for sharing a weekly planner via URL (day keys → meal ids per slot). */
export type SharedWeeklyPlan = WeeklyPlan;

const PLAN_PARAM = "plan";
const VALID_SLOTS: MealSlot[] = ["diner", "supper"];
const VALID_MEAL_IDS = new Set(meals.map((m) => m.id));
const VALID_DAY_KEYS = new Set<DayKey>(DAYS.map((d) => d.key));

export function encodeSharedWeeklyPlan(plan: WeeklyPlan): string {
  return btoa(JSON.stringify(plan));
}

export function decodeSharedWeeklyPlan(encoded: string): SharedWeeklyPlan | null {
  try {
    const json = atob(encoded);
    const parsed: unknown = JSON.parse(json);
    return sanitizeSharedWeeklyPlan(parsed);
  } catch {
    return null;
  }
}

export function sanitizeSharedWeeklyPlan(raw: unknown): SharedWeeklyPlan | null {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const plan: SharedWeeklyPlan = {};

  for (const [dayKey, value] of Object.entries(record)) {
    if (!VALID_DAY_KEYS.has(dayKey as DayKey)) continue;
    if (!value || typeof value !== "object") continue;

    const dayPlan: DayPlan = {};
    for (const slot of VALID_SLOTS) {
      const mealId = (value as Record<string, unknown>)[slot];
      if (typeof mealId === "string" && VALID_MEAL_IDS.has(mealId)) {
        dayPlan[slot] = mealId;
      }
    }

    if (dayPlan.supper || dayPlan.diner) {
      plan[dayKey as DayKey] = dayPlan;
    }
  }

  return plan;
}

export function buildPlannerShareUrl(plan: WeeklyPlan): string {
  const url = new URL(appPath("planner"), window.location.href);
  url.searchParams.set(PLAN_PARAM, encodeSharedWeeklyPlan(plan));
  return url.href;
}

export function readPlannerShareParam(): SharedWeeklyPlan | null {
  const encoded = new URLSearchParams(window.location.search).get(PLAN_PARAM);
  if (!encoded) return null;
  return decodeSharedWeeklyPlan(encoded);
}

export function clearPlannerShareParam(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(PLAN_PARAM)) return;
  url.searchParams.delete(PLAN_PARAM);
  window.history.replaceState({}, "", url.href);
}
