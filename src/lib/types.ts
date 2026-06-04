export type DurationTag = "short" | "medium" | "long";

export interface Ingredient {
  name: string;
  quantity: string;
}

export interface Meal {
  id: string;
  name: string;
  duration: DurationTag;
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

export const DAYS: { key: DayKey; label: string }[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];
