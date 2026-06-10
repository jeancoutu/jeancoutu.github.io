import { derived, get, writable } from "svelte/store";
import type { IngredientCategory } from "../types";
import { selectedWeek } from "./weeklyPlan";

const STORAGE_KEY = "grocery-list";

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

const lists = writable<StoredGroceryLists>(loadStored());

lists.subscribe((data) => saveStored(data));

function updateWeek(
  weekKey: string,
  updater: (state: WeekGroceryState) => WeekGroceryState,
): void {
  lists.update((all) => {
    const current = normalizeWeekState(all[weekKey] ?? emptyWeekState());
    const next = updater(current);
    const hasState =
      next.checked.length > 0 ||
      next.removed.length > 0 ||
      next.added.length > 0;
    if (!hasState) {
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
