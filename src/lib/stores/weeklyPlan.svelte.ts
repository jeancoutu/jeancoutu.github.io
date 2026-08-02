import type { DayKey, MealSlot, WeeklyPlan } from "../types";
import { DAYS } from "../types";
import { meals, getMealById } from "./meals.svelte";
import { previousDay } from "../utils/dayOrder";
import { mealsEligibleForSupper } from "../utils/supperDays";
import { shuffle } from "../utils/shuffle";
import { getWeekSaturday, toWeekKey, addWeeks, parseWeekKey } from "../utils/weekDates";
import { onUserChange } from "./auth.svelte";
import { onSynced } from "../sync/status.svelte";
import { weeklyPlanRepo } from "../repos/weeklyPlanRepo";
import { groceryItemRepo, type GroceryDBItem } from "../repos/groceryItemRepo";
import { getPlannedMeals, buildGroceryList, formatGroceryQuantities, computeGroceryAdjustments } from "../utils/groceryList";

export type { GroceryDBItem };

const defaultWeek = toWeekKey(getWeekSaturday());

class WeeklyPlanStore {
  selectedWeek = $state<string>(defaultWeek);
  plans = $state<Record<string, WeeklyPlan>>({});
  dismissedNamesPerWeek = $state<Record<string, string[]>>({});

  current = $derived(this.plans[this.selectedWeek] ?? {});
  dismissedIngredients = $derived(this.dismissedNamesPerWeek[this.selectedWeek] ?? []);

  async #loadWeek(week: string): Promise<void> {
    const row = await weeklyPlanRepo.getByWeek(week);
    this.plans = { ...this.plans, [week]: row?.plan ?? {} };
    this.dismissedNamesPerWeek = { ...this.dismissedNamesPerWeek, [week]: row?.dismissedNames ?? [] };
  }

  async #updateSlot(
    day: DayKey,
    slot: MealSlot,
    mealId: string | undefined,
  ): Promise<GroceryDBItem[] | null> {
    const week = this.selectedWeek;
    const id = mealId ?? null;
    // this.plans is a deep-reactive $state proxy tree; snapshot it before
    // building the object we hand to Dexie, or unmodified days stay Proxy
    // objects nested in the payload and IDBObjectStore.put throws
    // DataCloneError, silently dropping the write.
    const oldPlan = $state.snapshot(this.plans[week] ?? {});
    const row = await weeklyPlanRepo.getOrCreate(week);

    const current = { ...oldPlan };
    const dayEntry = { ...(current[day] ?? {}) };
    if (id) {
      dayEntry[slot] = id;
    } else {
      delete dayEntry[slot];
    }
    if (dayEntry.supper || dayEntry.diner || dayEntry.note) {
      current[day] = dayEntry;
    } else {
      delete current[day];
    }

    const updatedRow = await weeklyPlanRepo.save(row, { plan: current });
    this.plans = { ...this.plans, [week]: updatedRow.plan };

    const adjustments = computeGroceryAdjustments(oldPlan, updatedRow.plan, getMealById);
    if (adjustments.length === 0) return null;
    return groceryItemRepo.applyAdjustments(updatedRow.id, adjustments, updatedRow.dismissedNames);
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

  async swapSlots(
    source: { day: DayKey; slot: MealSlot },
    target: { day: DayKey; slot: MealSlot },
  ): Promise<GroceryDBItem[] | null> {
    if (source.day === target.day && source.slot === target.slot) return null;

    const week = this.selectedWeek;
    // See #updateSlot: snapshot to strip $state Proxies before saving to Dexie.
    const oldPlan = $state.snapshot(this.plans[week] ?? {});
    const row = await weeklyPlanRepo.getOrCreate(week);

    const sourceMealId = oldPlan[source.day]?.[source.slot];
    const targetMealId = oldPlan[target.day]?.[target.slot];

    const current = { ...oldPlan };
    const sourceDayEntry = { ...(current[source.day] ?? {}) };
    const targetDayEntry =
      source.day === target.day ? sourceDayEntry : { ...(current[target.day] ?? {}) };

    if (targetMealId) sourceDayEntry[source.slot] = targetMealId;
    else delete sourceDayEntry[source.slot];

    if (sourceMealId) targetDayEntry[target.slot] = sourceMealId;
    else delete targetDayEntry[target.slot];

    for (const [day, entry] of [
      [source.day, sourceDayEntry],
      [target.day, targetDayEntry],
    ] as const) {
      if (entry.supper || entry.diner || entry.note) current[day] = entry;
      else delete current[day];
    }

    const updatedRow = await weeklyPlanRepo.save(row, { plan: current });
    this.plans = { ...this.plans, [week]: updatedRow.plan };

    const adjustments = computeGroceryAdjustments(oldPlan, updatedRow.plan, getMealById);
    if (adjustments.length === 0) return null;
    return groceryItemRepo.applyAdjustments(updatedRow.id, adjustments, updatedRow.dismissedNames);
  }

  async setDayNote(day: DayKey, note: string | null): Promise<void> {
    const week = this.selectedWeek;
    const row = await weeklyPlanRepo.getOrCreate(week);

    // See #updateSlot: snapshot to strip $state Proxies before saving to Dexie.
    const current = $state.snapshot(this.plans[week] ?? {});
    const dayEntry = { ...(current[day] ?? {}) };
    if (note) {
      dayEntry.note = note;
    } else {
      delete dayEntry.note;
    }
    if (dayEntry.supper || dayEntry.diner || dayEntry.note) {
      current[day] = dayEntry;
    } else {
      delete current[day];
    }

    const updatedRow = await weeklyPlanRepo.save(row, { plan: current });
    this.plans = { ...this.plans, [week]: updatedRow.plan };
  }

  async clearWeek(): Promise<void> {
    const week = this.selectedWeek;
    const row = await weeklyPlanRepo.clearPlan(week);
    if (row) await groceryItemRepo.deleteAll(row.id);
    const { [week]: _, ...rest } = this.plans;
    this.plans = rest;
  }

  async importPlan(plan: WeeklyPlan, weekStart?: string): Promise<void> {
    const week = weekStart ?? this.selectedWeek;
    this.selectedWeek = week;

    const updatedRow = await weeklyPlanRepo.setPlan(week, plan);
    this.plans = { ...this.plans, [week]: updatedRow.plan };
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
      const placedTagsByDay = new Map<DayKey, Set<string>>();
      for (const { key } of DAYS) {
        const day = current[key];
        if (day?.supper) {
          usedIds.add(day.supper);
          const supperMeal = getMealById(day.supper);
          if (supperMeal && supperMeal.tags.length > 0) {
            placedTagsByDay.set(key, new Set(supperMeal.tags));
          }
        }
        if (day?.diner) usedIds.add(day.diner);
      }
      const previousWeekKey = toWeekKey(addWeeks(parseWeekKey(week), -1));
      const previousWeekIds = await weeklyPlanRepo.getMealIds(previousWeekKey);
      for (const { key } of emptySuppers) {
        const candidates = shuffle(
          mealsEligibleForSupper(meals.all, key, usedIds, previousWeekIds, placedTagsByDay),
        );
        const pick = candidates[0];
        if (!pick) continue;
        const entry = { ...(current[key] ?? {}) };
        entry.supper = pick.id;
        current[key] = entry;
        usedIds.add(pick.id);
        if (pick.tags.length > 0) placedTagsByDay.set(key, new Set(pick.tags));
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

    const updatedRow = await weeklyPlanRepo.setPlan(week, current);

    const plannedMeals = getPlannedMeals(current, getMealById);
    const groceries = buildGroceryList(plannedMeals);
    await groceryItemRepo.replaceAll(
      updatedRow.id,
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
    await weeklyPlanRepo.dismissIngredient(week, name);
    if (dbId) {
      await groceryItemRepo.delete(dbId);
    }
  }

  async undismissIngredient(name: string): Promise<void> {
    const week = this.selectedWeek;
    this.dismissedNamesPerWeek = {
      ...this.dismissedNamesPerWeek,
      [week]: (this.dismissedNamesPerWeek[week] ?? []).filter((n) => n !== name),
    };
    await weeklyPlanRepo.undismissIngredient(week, name);
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

// Cross-device / realtime changes land in Dexie via the sync engine, not
// through these store functions, so re-read the selected week after every
// successful sync.
onSynced(() => {
  void weeklyPlan.reloadWeek();
});
