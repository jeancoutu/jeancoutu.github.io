import { supabase } from "../supabase";
import type { DayKey, MealSlot, WeeklyPlan } from "../types";

type DayPlanRow = {
  id: string;
  day_key: string;
  supper_meal_id: string | null;
  diner_meal_id: string | null;
};

function rowsToPlan(rows: DayPlanRow[]): WeeklyPlan {
  const plan: WeeklyPlan = {};
  for (const row of rows) {
    const day = row.day_key as DayKey;
    const entry: { supper?: string; diner?: string } = {};
    if (row.supper_meal_id) entry.supper = row.supper_meal_id;
    if (row.diner_meal_id) entry.diner = row.diner_meal_id;
    if (entry.supper || entry.diner) plan[day] = entry;
  }
  return plan;
}

export async function getOrCreateWeeklyPlanId(weekStart: string): Promise<string> {
  const { data: existing, error: selectError } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("week_start", weekStart)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return (existing as { id: string }).id;

  const { data: created, error: insertError } = await supabase
    .from("weekly_plans")
    .insert({ week_start: weekStart })
    .select("id")
    .single();

  if (insertError) throw insertError;
  return (created as { id: string }).id;
}

export async function getWeeklyPlan(
  weekStart: string,
): Promise<{ plan: WeeklyPlan; dismissedNames: string[] }> {
  const { data: wp, error: wpError } = await supabase
    .from("weekly_plans")
    .select("id, dismissed_ingredient_names")
    .eq("week_start", weekStart)
    .maybeSingle();

  if (wpError) throw wpError;
  if (!wp) return { plan: {}, dismissedNames: [] };

  const { data: rows, error: dpError } = await supabase
    .from("day_plans")
    .select("id, day_key, supper_meal_id, diner_meal_id")
    .eq("weekly_plan_id", wp.id);

  if (dpError) throw dpError;
  return {
    plan: rowsToPlan((rows ?? []) as DayPlanRow[]),
    dismissedNames: (wp as { id: string; dismissed_ingredient_names: string[] }).dismissed_ingredient_names ?? [],
  };
}

export async function dismissIngredient(weekStart: string, name: string): Promise<void> {
  const { data: wp, error: wpError } = await supabase
    .from("weekly_plans")
    .select("id, dismissed_ingredient_names")
    .eq("week_start", weekStart)
    .maybeSingle();

  if (wpError) throw wpError;
  if (!wp) return;

  const current = (wp as { id: string; dismissed_ingredient_names: string[] }).dismissed_ingredient_names ?? [];
  if (current.includes(name)) return;

  const { error } = await supabase
    .from("weekly_plans")
    .update({ dismissed_ingredient_names: [...current, name] })
    .eq("week_start", weekStart);

  if (error) throw error;
}

export async function undismissIngredient(weekStart: string, name: string): Promise<void> {
  const { data: wp, error: wpError } = await supabase
    .from("weekly_plans")
    .select("id, dismissed_ingredient_names")
    .eq("week_start", weekStart)
    .maybeSingle();

  if (wpError) throw wpError;
  if (!wp) return;

  const current = (wp as { id: string; dismissed_ingredient_names: string[] }).dismissed_ingredient_names ?? [];
  const updated = current.filter((n) => n !== name);
  if (updated.length === current.length) return;

  const { error } = await supabase
    .from("weekly_plans")
    .update({ dismissed_ingredient_names: updated })
    .eq("week_start", weekStart);

  if (error) throw error;
}

export async function setMealSlot(
  weekStart: string,
  day: DayKey,
  slot: MealSlot,
  mealId: string | null,
): Promise<string> {
  const weeklyPlanId = await getOrCreateWeeklyPlanId(weekStart);
  const column = slot === "supper" ? "supper_meal_id" : "diner_meal_id";
  const otherColumn = slot === "supper" ? "diner_meal_id" : "supper_meal_id";
  if (mealId) {
    const { data: existing, error: selectError } = await supabase
      .from("day_plans")
      .select("id")
      .eq("weekly_plan_id", weeklyPlanId)
      .eq("day_key", day)
      .maybeSingle();

    if (selectError) throw selectError;

    if (existing) {
      const { error } = await supabase
        .from("day_plans")
        .update({ [column]: mealId })
        .eq("id", (existing as { id: string }).id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("day_plans").insert({
        weekly_plan_id: weeklyPlanId,
        day_key: day,
        [column]: mealId,
      });
      if (error) throw error;
    }
  } else {
    const { data: existing, error: selectError } = await supabase
      .from("day_plans")
      .select(`id, ${otherColumn}`)
      .eq("weekly_plan_id", weeklyPlanId)
      .eq("day_key", day)
      .maybeSingle();

    if (selectError) throw selectError;
    if (!existing) return weeklyPlanId;

    const otherValue = existing[otherColumn as keyof typeof existing];
    if (!otherValue) {
      const { error } = await supabase.from("day_plans").delete().eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("day_plans").update({ [column]: null }).eq("id", existing.id);
      if (error) throw error;
    }
  }
  return weeklyPlanId;
}

export async function clearPlan(weekStart: string): Promise<void> {
  const { data: wp, error: wpError } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("week_start", weekStart)
    .maybeSingle();

  if (wpError) throw wpError;
  if (!wp) return;

  const { error } = await supabase
    .from("day_plans")
    .delete()
    .eq("weekly_plan_id", wp.id);

  if (error) throw error;
}

export async function bulkSetWeekPlan(weekStart: string, plan: WeeklyPlan): Promise<void> {
  const weeklyPlanId = await getOrCreateWeeklyPlanId(weekStart);

  const { error: deleteError } = await supabase
    .from("day_plans")
    .delete()
    .eq("weekly_plan_id", weeklyPlanId);

  if (deleteError) throw deleteError;

  const rows = (Object.entries(plan) as [DayKey, WeeklyPlan[DayKey]][])
    .filter(([, entry]) => entry?.supper || entry?.diner)
    .map(([day, entry]) => ({
      weekly_plan_id: weeklyPlanId,
      day_key: day,
      supper_meal_id: entry?.supper ?? null,
      diner_meal_id: entry?.diner ?? null,
    }));

  if (rows.length === 0) return;

  const { error: insertError } = await supabase.from("day_plans").insert(rows);
  if (insertError) throw insertError;
}

export async function clearWeekData(weekStart: string): Promise<void> {
  const { data: wp, error: wpError } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("week_start", weekStart)
    .maybeSingle();

  if (wpError) throw wpError;
  if (!wp) return;

  const [dpResult, giResult] = await Promise.all([
    supabase.from("day_plans").delete().eq("weekly_plan_id", wp.id),
    supabase.from("grocery_items").delete().eq("weekly_plan_id", wp.id),
  ]);

  if (dpResult.error) throw dpResult.error;
  if (giResult.error) throw giResult.error;
}
