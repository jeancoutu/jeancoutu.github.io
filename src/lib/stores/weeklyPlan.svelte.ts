import type { DayKey, MealSlot, WeeklyPlan } from "../types";
import { DAYS } from "../types";
import { meals, getMealById } from "./meals.svelte";
import { previousDay } from "../utils/dayOrder";
import { mealsEligibleForSupper } from "../utils/supperDays";
import { shuffle } from "../utils/shuffle";
import { getWeekSaturday, toWeekKey } from "../utils/weekDates";
import { onUserChange } from "./auth.svelte";
import {
  getWeeklyPlan,
  setMealSlot,
  clearWeekData,
  bulkSetWeekPlan,
  dismissIngredient as apiDismissIngredient,
  undismissIngredient as apiUndismissIngredient,
} from "../api/plan";
import { bulkReplaceGroceryItems, applyGroceryAdjustments, deleteGroceryItem, type GroceryDBItem } from "../api/groceryList";
import { getPlannedMeals, buildGroceryList, formatGroceryQuantities, computeGroceryAdjustments } from "../utils/groceryList";

const defaultWeek = toWeekKey(getWeekSaturday());

class WeeklyPlanStore {
  selectedWeek = $state<string>(defaultWeek);
  plans = $state<Record<string, WeeklyPlan>>({});
  dismissedNamesPerWeek = $state<Record<string, string[]>>({});

  current = $derived(this.plans[this.selectedWeek] ?? {});
  dismissedIngredients = $derived(this.dismissedNamesPerWeek[this.selectedWeek] ?? []);

  async #loadWeek(week: string): Promise<void> {
    const { plan, dismissedNames } = await getWeeklyPlan(week);
    this.plans = { ...this.plans, [week]: plan };
    this.dismissedNamesPerWeek = { ...this.dismissedNamesPerWeek, [week]: dismissedNames };
  }

  async #updateSlot(
    day: DayKey,
    slot: MealSlot,
    mealId: string | undefined,
  ): Promise<GroceryDBItem[] | null> {
    const week = this.selectedWeek;
    const id = mealId ?? null;
    const oldPlan = this.plans[week] ?? {};

    const weeklyPlanId = await setMealSlot(week, day, slot, id);
    const current = { ...(this.plans[week] ?? {}) };
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
    this.plans = { ...this.plans, [week]: current };

    const newPlan = this.plans[week] ?? {};
    const adjustments = computeGroceryAdjustments(oldPlan, newPlan, getMealById);
    const dismissedNames = this.dismissedNamesPerWeek[week] ?? [];
    return applyGroceryAdjustments(week, adjustments, weeklyPlanId, dismissedNames);
  }

  async setSelectedWeek(weekKey: string): Promise<void> {
    this.selectedWeek = weekKey;
    const cached = this.plans[weekKey];
    if (!cached) {
      await this.#loadWeek(weekKey);
    }
  }

  async setDay(day: DayKey, slot: MealSlot, mealId: string | undefined): Promise<GroceryDBItem[] | null> {
    return this.#updateSlot(day, slot, mealId);
  }

  async clearWeek(): Promise<void> {
    const week = this.selectedWeek;
    await clearWeekData(week);
    const { [week]: _, ...rest } = this.plans;
    this.plans = rest;
  }

  async importPlan(plan: WeeklyPlan, weekStart?: string): Promise<void> {
    const week = weekStart ?? this.selectedWeek;
    this.selectedWeek = week;

    await bulkSetWeekPlan(week, plan);

    this.plans = { ...this.plans, [week]: plan };
  }

  async autoFillWeek(): Promise<void> {
    const week = this.selectedWeek;
    const current = { ...(this.plans[week] ?? {}) };

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
        const candidates = shuffle(mealsEligibleForSupper(meals.all, key, usedIds));
        const pick = candidates[0];
        if (!pick) continue;
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

    this.plans = { ...this.plans, [week]: current };

    await bulkSetWeekPlan(week, current);

    const plannedMeals = getPlannedMeals(current, getMealById);
    const groceries = buildGroceryList(plannedMeals);
    await bulkReplaceGroceryItems(
      week,
      groceries.map((item) => ({
        name: item.name,
        category: item.category,
        quantity: formatGroceryQuantities(item.quantities),
        checked: false,
      })),
    );
  }

  getSnapshot(): WeeklyPlan {
    return this.current;
  }

  async reloadWeek(): Promise<void> {
    await this.#loadWeek(this.selectedWeek);
  }

  getSelectedWeek(): string {
    return this.selectedWeek;
  }

  getAllPlans(): Record<string, WeeklyPlan> {
    return this.plans;
  }

  async dismissIngredient(name: string, dbId?: string): Promise<void> {
    const week = this.selectedWeek;
    const currentNames = this.dismissedNamesPerWeek[week] ?? [];
    if (!currentNames.includes(name)) {
      this.dismissedNamesPerWeek = { ...this.dismissedNamesPerWeek, [week]: [...currentNames, name] };
    }
    await apiDismissIngredient(week, name);
    if (dbId) {
      await deleteGroceryItem(dbId);
    }
  }

  async undismissIngredient(name: string): Promise<void> {
    const week = this.selectedWeek;
    this.dismissedNamesPerWeek = {
      ...this.dismissedNamesPerWeek,
      [week]: (this.dismissedNamesPerWeek[week] ?? []).filter((n) => n !== name),
    };
    await apiUndismissIngredient(week, name);
  }
}

export const weeklyPlan = new WeeklyPlanStore();

onUserChange(async ($session) => {
  if ($session) {
    await weeklyPlan.reloadWeek();
  } else {
    weeklyPlan.plans = {};
    weeklyPlan.dismissedNamesPerWeek = {};
    weeklyPlan.selectedWeek = toWeekKey(getWeekSaturday());
  }
});
