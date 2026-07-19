export type DurationTag = "short" | "medium" | "long";

export type IngredientCategory =
  | "vegetables"
  | "bakery"
  | "meat"
  | "aisle"
  | "fridge";

export const INGREDIENT_CATEGORIES: IngredientCategory[] = [
  "vegetables",
  "bakery",
  "meat",
  "aisle",
  "fridge",
];

export interface Ingredient {
  name: string;
  quantity: string;
  category: IngredientCategory;
  section?: string | null;
}

export interface Meal {
  id: string;
  name: string;
  duration: DurationTag;
  /** Days this meal may be picked for supper during auto fill (0–7 unique). */
  supperDays: DayKey[];
  /** External recipe link (video, blog). Empty when not set. */
  url: string;
  ingredients: Ingredient[];
  instructions: string[];
  /** Free-text tags, stored trimmed + lowercased (see normalizeTags). */
  tags: string[];
}

export type GroceryPresetItem = Ingredient;

export interface GroceryPreset {
  id: string;
  name: string;
  items: GroceryPresetItem[];
}

export type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type MealSlot = "supper" | "diner";

export interface DayPlan {
  supper?: string;
  diner?: string;
  note?: string;
}

export interface WeeklyPlan {
  monday?: DayPlan;
  tuesday?: DayPlan;
  wednesday?: DayPlan;
  thursday?: DayPlan;
  friday?: DayPlan;
  saturday?: DayPlan;
  sunday?: DayPlan;
}

export const DAYS: { key: DayKey }[] = [
  { key: "saturday" },
  { key: "sunday" },
  { key: "monday" },
  { key: "tuesday" },
  { key: "wednesday" },
  { key: "thursday" },
  { key: "friday" },
];
