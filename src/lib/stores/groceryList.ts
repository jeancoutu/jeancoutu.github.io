import { derived, get, writable } from "svelte/store";
import type { IngredientCategory } from "../types";
import { INGREDIENT_CATEGORIES } from "../types";
import { selectedWeek } from "./weeklyPlan";

const STORAGE_KEY = "grocery-list";
const VALID_GROCERY_CATEGORIES = new Set(INGREDIENT_CATEGORIES);

export interface CustomGroceryItem {
  name: string;
  category: IngredientCategory;
  quantity: string;
}

export interface WeekGroceryState {
  checked: string[];
  removed: string[];
  added: CustomGroceryItem[];
}

type StoredGroceryLists = Record<string, WeekGroceryState>;

function loadStored(): StoredGroceryLists {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredGroceryLists;
  } catch {
    return {};
  }
}

function saveStored(data: StoredGroceryLists): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function emptyWeekState(): WeekGroceryState {
  return { checked: [], removed: [], added: [] };
}

function normalizeWeekState(state: Partial<WeekGroceryState>): WeekGroceryState {
  return {
    checked: state.checked ?? [],
    removed: state.removed ?? [],
    added: state.added ?? [],
  };
}

function hasState(state: WeekGroceryState): boolean {
  return (
    state.checked.length > 0 ||
    state.removed.length > 0 ||
    state.added.length > 0
  );
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeAddedItems(value: unknown): CustomGroceryItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const record = item as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name.trim() : "";
      const quantity =
        typeof record.quantity === "string" ? record.quantity.trim() : "1";

      if (!name || !VALID_GROCERY_CATEGORIES.has(record.category as IngredientCategory)) {
        return null;
      }

      return {
        name,
        category: record.category as IngredientCategory,
        quantity: quantity || "1",
      };
    })
    .filter((item): item is CustomGroceryItem => item !== null);
}

function sanitizeWeekState(state: Partial<WeekGroceryState>): WeekGroceryState {
  return normalizeWeekState({
    checked: normalizeStringArray(state.checked),
    removed: normalizeStringArray(state.removed),
    added: normalizeAddedItems(state.added),
  });
}

const lists = writable<StoredGroceryLists>(loadStored());

lists.subscribe((data) => saveStored(data));

function updateWeek(
  weekKey: string,
  updater: (state: WeekGroceryState) => WeekGroceryState,
): void {
  lists.update((all) => {
    const current = normalizeWeekState(all[weekKey] ?? emptyWeekState());
    const next = updater(current);
    if (!hasState(next)) {
      const { [weekKey]: _, ...rest } = all;
      return rest;
    }
    return { ...all, [weekKey]: next };
  });
}

export const groceryListState = derived(
  [selectedWeek, lists],
  ([weekKey, all]) => normalizeWeekState(all[weekKey] ?? emptyWeekState()),
);

export function importGroceryList(weekKey: string, state: WeekGroceryState): void {
  const next = sanitizeWeekState(state);

  lists.update((all) => {
    if (!hasState(next)) {
      const { [weekKey]: _, ...rest } = all;
      return rest;
    }

    return { ...all, [weekKey]: next };
  });
}

export function toggleGroceryChecked(name: string): void {
  const weekKey = get(selectedWeek);
  updateWeek(weekKey, (state) => {
    const checked = new Set(state.checked);
    if (checked.has(name)) checked.delete(name);
    else checked.add(name);
    return { ...state, checked: [...checked] };
  });
}

export function addGroceryItem(
  category: IngredientCategory,
  name: string,
  quantity = "1",
): void {
  const trimmedName = name.trim();
  if (!trimmedName) return;

  const weekKey = get(selectedWeek);
  updateWeek(weekKey, (state) => {
    const removed = state.removed.filter((item) => item !== trimmedName);
    const trimmedQuantity = quantity.trim() || "1";
    const existing = state.added.find(
      (item) => item.name === trimmedName && item.category === category,
    );

    const added = existing
      ? state.added.map((item) =>
          item.name === trimmedName && item.category === category
            ? {
                ...item,
                quantity: item.quantity
                  ? `${item.quantity}, ${trimmedQuantity}`
                  : trimmedQuantity,
              }
            : item,
        )
      : [...state.added, { name: trimmedName, category, quantity: trimmedQuantity }];

    return { ...state, removed, added };
  });
}

export function removeGroceryItem(name: string): void {
  const weekKey = get(selectedWeek);
  updateWeek(weekKey, (state) => {
    const removed = new Set(state.removed);
    removed.add(name);
    const checked = state.checked.filter((item) => item !== name);
    return { ...state, removed: [...removed], checked };
  });
}

export function restoreGroceryItem(name: string): void {
  const weekKey = get(selectedWeek);
  updateWeek(weekKey, (state) => ({
    ...state,
    removed: state.removed.filter((item) => item !== name),
  }));
}

export function restoreAllGroceryItems(): void {
  const weekKey = get(selectedWeek);
  updateWeek(weekKey, (state) => ({ ...state, removed: [] }));
}

export function isGroceryChecked(name: string, state: WeekGroceryState): boolean {
  return state.checked.includes(name);
}

export function isGroceryRemoved(name: string, state: WeekGroceryState): boolean {
  return state.removed.includes(name);
}
