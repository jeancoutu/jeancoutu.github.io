import type {
  DayKey,
  DayPlan,
  IngredientCategory,
  MealSlot,
  WeeklyPlan,
} from "../types";
import { DAYS, INGREDIENT_CATEGORIES } from "../types";
import type { WeekGroceryState } from "../stores/groceryList";
import { meals } from "../../data/meals";
import { appPath } from "./paths";
import { getWeekSaturday, toWeekKey } from "./weekDates";

export interface SharedPlanPayload {
  /** Saturday (YYYY-MM-DD) that starts the shared week. */
  weekStart: string;
  plan: WeeklyPlan;
  groceryList?: WeekGroceryState;
}

const PLAN_PARAM = "plan";
const VALID_SLOTS: MealSlot[] = ["diner", "supper"];
const VALID_MEAL_IDS = new Set(meals.map((m) => m.id));
const VALID_DAY_KEYS = new Set<DayKey>(DAYS.map((d) => d.key));
const VALID_GROCERY_CATEGORIES = new Set(INGREDIENT_CATEGORIES);
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

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function sanitizeGroceryList(raw: unknown): WeekGroceryState | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  const record = raw as Record<string, unknown>;
  const added: WeekGroceryState["added"] = [];

  if (Array.isArray(record.added)) {
    for (const item of record.added) {
      if (!item || typeof item !== "object") continue;

      const itemRecord = item as Record<string, unknown>;
      const name =
        typeof itemRecord.name === "string" ? itemRecord.name.trim() : "";
      const quantity =
        typeof itemRecord.quantity === "string"
          ? itemRecord.quantity.trim() || "1"
          : "1";

      if (
        !name ||
        !VALID_GROCERY_CATEGORIES.has(
          itemRecord.category as WeekGroceryState["added"][number]["category"],
        )
      ) {
        continue;
      }

      added.push({ name, category: itemRecord.category as IngredientCategory, quantity });
    }
  }

  const groceryList: WeekGroceryState = {
    checked: normalizeStringArray(record.checked),
    removed: normalizeStringArray(record.removed),
    added,
  };

  if (
    groceryList.checked.length === 0 &&
    groceryList.removed.length === 0 &&
    groceryList.added.length === 0
  ) {
    return undefined;
  }

  return groceryList;
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
    const groceryList = sanitizeGroceryList(record.groceryList);

    return groceryList ? { weekStart, plan, groceryList } : { weekStart, plan };
  }

  if (isWeeklyPlanShape(record)) {
    const plan = sanitizePlan(record);
    if (!plan) return null;
    return { weekStart: toWeekKey(getWeekSaturday()), plan };
  }

  return null;
}

export function encodeSharedWeeklyPlan(
  plan: WeeklyPlan,
  weekStart: string,
  groceryList?: WeekGroceryState,
): string {
  const payload: SharedPlanPayload = groceryList
    ? { weekStart, plan, groceryList }
    : { weekStart, plan };
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

export function buildPlannerShareUrl(
  plan: WeeklyPlan,
  weekStart: string,
  groceryList?: WeekGroceryState,
): string {
  const url = new URL(appPath("planner"), window.location.href);
  url.searchParams.set(
    PLAN_PARAM,
    encodeSharedWeeklyPlan(plan, weekStart, groceryList),
  );
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
