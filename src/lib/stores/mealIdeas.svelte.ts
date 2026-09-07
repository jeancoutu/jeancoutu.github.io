import type { MealIdea } from "../types";
import { onUserChange } from "./auth.svelte";
import { mealIdeaRepo } from "../repos/mealIdeaRepo";
import { onSynced } from "../sync/status.svelte";

class MealIdeasStore {
  all = $state<MealIdea[]>([]);
}

export const mealIdeas = new MealIdeasStore();

async function refresh(): Promise<void> {
  mealIdeas.all = await mealIdeaRepo.getAll();
}

// Reads always come from IndexedDB, not the network, so this works offline
// with a cached session. A logout/switch wipes IndexedDB (see src/lib/db),
// which the next refresh reflects as an empty list.
onUserChange(async ($session) => {
  if ($session) {
    await refresh();
  } else {
    mealIdeas.all = [];
  }
});

// Cross-device / realtime changes land in Dexie via the sync engine, not
// through these store functions, so re-read after every successful sync.
onSynced(() => {
  void refresh();
});

export async function addIdea(text: string): Promise<MealIdea> {
  const idea = await mealIdeaRepo.create(text);
  // Prepend so newest-first holds without a full refresh.
  mealIdeas.all = [idea, ...mealIdeas.all];
  return idea;
}

export async function updateIdea(id: string, text: string): Promise<MealIdea> {
  const idea = await mealIdeaRepo.update(id, text);
  mealIdeas.all = mealIdeas.all.map((i) => (i.id === id ? idea : i));
  return idea;
}

export async function deleteIdeaById(id: string): Promise<void> {
  await mealIdeaRepo.delete(id);
  mealIdeas.all = mealIdeas.all.filter((i) => i.id !== id);
}
