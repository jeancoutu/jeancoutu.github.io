import { db, enqueue, type LocalWeeklyPlan } from "../db";
import type { WeeklyPlan } from "../types";

export class WeeklyPlanRepository {
  async getByWeek(weekStart: string): Promise<LocalWeeklyPlan | undefined> {
    return db.weeklyPlans.where("weekStart").equals(weekStart).and((p) => !p.deletedAt).first();
  }

  async getOrCreate(weekStart: string): Promise<LocalWeeklyPlan> {
    const existing = await this.getByWeek(weekStart);
    if (existing) return existing;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const row: LocalWeeklyPlan = {
      id,
      weekStart,
      plan: {},
      dismissedNames: [],
      presetIds: [],
      version: 1,
      updatedAt: now,
      deletedAt: null,
    };
    await db.weeklyPlans.put(row);
    await enqueue("weeklyPlan", id, "upsert", null, row);
    return row;
  }

  async save(row: LocalWeeklyPlan, patch: Partial<Pick<LocalWeeklyPlan, "plan" | "dismissedNames" | "presetIds">>): Promise<LocalWeeklyPlan> {
    const updated: LocalWeeklyPlan = { ...row, ...patch, updatedAt: new Date().toISOString() };
    await db.weeklyPlans.put(updated);
    await enqueue("weeklyPlan", row.id, "upsert", row.version, updated);
    return updated;
  }

  async setPlan(weekStart: string, plan: WeeklyPlan): Promise<LocalWeeklyPlan> {
    const row = await this.getOrCreate(weekStart);
    return this.save(row, { plan });
  }

  // Meal ids already booked into a week, used by auto-fill's
  // "don't repeat last week's supper" rule.
  async getMealIds(weekStart: string): Promise<Set<string>> {
    const row = await this.getByWeek(weekStart);
    const ids = new Set<string>();
    if (!row) return ids;
    for (const day of Object.values(row.plan)) {
      if (day?.supper) ids.add(day.supper);
      if (day?.diner) ids.add(day.diner);
    }
    return ids;
  }

  async clearPlan(weekStart: string): Promise<LocalWeeklyPlan | undefined> {
    const row = await this.getByWeek(weekStart);
    if (!row) return undefined;
    return this.save(row, { plan: {} });
  }

  async dismissIngredient(weekStart: string, name: string): Promise<LocalWeeklyPlan> {
    const row = await this.getOrCreate(weekStart);
    if (row.dismissedNames.includes(name)) return row;
    return this.save(row, { dismissedNames: [...row.dismissedNames, name] });
  }

  async undismissIngredient(weekStart: string, name: string): Promise<LocalWeeklyPlan> {
    const row = await this.getOrCreate(weekStart);
    if (!row.dismissedNames.includes(name)) return row;
    return this.save(row, { dismissedNames: row.dismissedNames.filter((n) => n !== name) });
  }

  async setPresetActive(weekStart: string, presetId: string, active: boolean): Promise<LocalWeeklyPlan> {
    const row = await this.getOrCreate(weekStart);
    const has = row.presetIds.includes(presetId);
    if (active === has) return row;
    const presetIds = active ? [...row.presetIds, presetId] : row.presetIds.filter((id) => id !== presetId);
    return this.save(row, { presetIds });
  }
}

export const weeklyPlanRepo = new WeeklyPlanRepository();
