import type { DayKey, MealSlot } from "../types";

export interface SlotRef {
  day: DayKey;
  slot: MealSlot;
}

class DragState {
  source = $state<SlotRef | null>(null);
  over = $state<SlotRef | null>(null);
}

export const dragState = new DragState();

export function isSameSlot(a: SlotRef | null, b: SlotRef | null): boolean {
  return !!a && !!b && a.day === b.day && a.slot === b.slot;
}
