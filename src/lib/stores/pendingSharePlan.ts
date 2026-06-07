import { writable } from "svelte/store";
import type { SharedPlanPayload } from "../utils/planShare";

function createPendingSharePlanStore() {
  const { subscribe, set } = writable<SharedPlanPayload | null>(null);

  return {
    subscribe,
    setPending(payload: SharedPlanPayload) {
      set(payload);
    },
    clear() {
      set(null);
    },
  };
}

export const pendingSharePlan = createPendingSharePlanStore();
