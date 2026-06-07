import type { DayKey, DayPlan, MealSlot, WeeklyPlan } from "../types";
import { DAYS } from "../types";
import { meals } from "../../data/meals";
import { appPath } from "./paths";
import { getWeekSaturday, toWeekKey } from "./weekDates";

export interface SharedPlanPayload {
  /** Saturday (YYYY-MM-DD) that starts the shared week. */
  weekStart: string;
  plan: WeeklyPlan;
}

const PLAN_PARAM = "plan";
const VALID_SLOTS: MealSlot[] = ["diner", "supper"];
const VALID_MEAL_IDS = new Set(meals.map((m) => m.id));
const VALID_DAY_KEYS = new Set<DayKey>(DAYS.map((d) => d.key));
const WEEK_START_RE = /^\d{4}-\d{2}-\d{2}$/;

function sanitizePlan(raw: unknown): WeeklyPlan | null {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const plan: WeeklyPlan = {};

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

  return Object.keys(plan).length > 0 ? plan : null;
}

function isWeeklyPlanShape(record: Record<string, unknown>): boolean {
  return Object.keys(record).some((key) => VALID_DAY_KEYS.has(key as DayKey));
}

export function sanitizeSharedPlanPayload(raw: unknown): SharedPlanPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;

  if ("plan" in record && record.plan && typeof record.plan === "object") {
    const plan = sanitizePlan(record.plan);
    if (!plan) return null;

    const weekStart =
      typeof record.weekStart === "string" && WEEK_START_RE.test(record.weekStart)
        ? record.weekStart
        : toWeekKey(getWeekSaturday());

    return { weekStart, plan };
  }

  if (isWeeklyPlanShape(record)) {
    const plan = sanitizePlan(record);
    if (!plan) return null;
    return { weekStart: toWeekKey(getWeekSaturday()), plan };
  }

  return null;
}

export function encodeSharedWeeklyPlan(plan: WeeklyPlan, weekStart: string): string {
  const payload: SharedPlanPayload = { weekStart, plan };
  return btoa(JSON.stringify(payload));
}

export function decodeSharedWeeklyPlan(encoded: string): SharedPlanPayload | null {
  try {
    const json = atob(encoded);
    const parsed: unknown = JSON.parse(json);
    return sanitizeSharedPlanPayload(parsed);
  } catch {
    return null;
  }
}

export function buildPlannerShareUrl(plan: WeeklyPlan, weekStart: string): string {
  const url = new URL(appPath("planner"), window.location.href);
  url.searchParams.set(PLAN_PARAM, encodeSharedWeeklyPlan(plan, weekStart));
  return url.href;
}

export function readPlannerShareParam(): SharedPlanPayload | null {
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
