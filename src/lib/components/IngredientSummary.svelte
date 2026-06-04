<script lang="ts">
  import type { Meal, MealSlot } from "../types";
  import { DAYS } from "../types";
  import { weeklyPlan } from "../stores/weeklyPlan";
  import { getMealById } from "../stores/meals";

  const slots: MealSlot[] = ["supper", "diner"];

  let plannedMeals = $derived.by(() => {
    const seen = new Set<string>();
    const unique: Meal[] = [];
    for (const { key } of DAYS) {
      for (const slot of slots) {
        const id = $weeklyPlan[key]?.[slot];
        if (!id || seen.has(id)) continue;
        const meal = getMealById(id);
        if (!meal) continue;
        seen.add(id);
        unique.push(meal);
      }
    }
    return unique;
  });
</script>

<section class="mt-6">
  <h2 class="mb-4 text-lg font-semibold text-slate-900">
    Ingredients Needed This Week
  </h2>

  {#if plannedMeals.length === 0}
    <p class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
      No meals planned yet. Assign meals to days above to see ingredients.
    </p>
  {:else}
    <div class="space-y-4">
      {#each plannedMeals as meal (meal.id)}
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 class="font-semibold text-slate-900">{meal.name}</h3>
          <ul class="mt-2 space-y-1">
            {#each meal.ingredients as ingredient}
              <li class="text-sm text-slate-700">
                – {ingredient.quantity}
                {ingredient.name}
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
  {/if}
</section>
