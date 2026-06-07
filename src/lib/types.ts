export type DurationTag = "short" | "medium" | "long";

export interface Ingredient {
  name: string;
  quantity: string;
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
