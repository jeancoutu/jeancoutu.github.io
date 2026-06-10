<script lang="ts">
  import { _ } from "svelte-i18n";
  import type { IngredientCategory } from "../types";
  import { weeklyPlan } from "../stores/weeklyPlan";
  import {
    addGroceryItem,
    groceryListState,
    isGroceryChecked,
    isGroceryRemoved,
    removeGroceryItem,
    restoreAllGroceryItems,
    restoreGroceryItem,
    toggleGroceryChecked,
  } from "../stores/groceryList";
  import {
    buildGroceryList,
    formatGroceryQuantities,
    getPlannedMeals,
    groupGroceryByCategory,
  } from "../utils/groceryList";

  let plannedMeals = $derived(getPlannedMeals($weeklyPlan));
  let groceryItems = $derived(
    buildGroceryList(plannedMeals, $groceryListState.added),
  );
  let visibleItems = $derived(
    groceryItems.filter((item) => !isGroceryRemoved(item.name, $groceryListState)),
  );
  let groupedItems = $derived(groupGroceryByCategory(visibleItems));
  let removedItems = $derived(
    groceryItems
      .filter((item) => isGroceryRemoved(item.name, $groceryListState))
      .sort((a, b) => a.name.localeCompare(b.name, "fr")),
  );

  let addingCategory = $state<IngredientCategory | null>(null);
  let newItemName = $state("");
  let newItemQuantity = $state("");

  function startAdding(category: IngredientCategory) {
    addingCategory = category;
    newItemName = "";
    newItemQuantity = "";
  }

  function cancelAdding() {
    addingCategory = null;
    newItemName = "";
    newItemQuantity = "";
  }

  function submitAdd() {
    if (!addingCategory || !newItemName.trim()) return;
    addGroceryItem(addingCategory, newItemName, newItemQuantity);
    cancelAdding();
  }

  function handleAddKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      submitAdd();
    } else if (event.key === "Escape") {
      cancelAdding();
    }
  }
</script>

<section class="mt-6">
  <h2 class="mb-4 text-lg font-semibold text-slate-900">
    {$_("grocery.title")}
  </h2>

  {#if visibleItems.length === 0}
    <p class="mb-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
      {$_("grocery.empty")}
    </p>
  {/if}

  <div class="space-y-4">
    {#each groupedItems as group (group.category)}
      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-orange-600">
            {$_(`grocery.category.${group.category}`)}
          </h3>
          <button
            type="button"
            class="flex size-7 shrink-0 items-center justify-center rounded-full border border-orange-200 text-orange-600 transition hover:bg-orange-50 active:bg-orange-100"
            aria-label={$_("grocery.add")}
            onclick={() => startAdding(group.category)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-4">
              <path
                d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z"
              />
            </svg>
          </button>
        </div>

        {#if addingCategory === group.category}
          <form
            class="mt-3 flex flex-wrap items-end gap-2"
            onsubmit={(event) => {
              event.preventDefault();
              submitAdd();
            }}
          >
            <label class="min-w-0 flex-1">
              <span class="sr-only">{$_("grocery.addName")}</span>
              <input
                type="text"
                bind:value={newItemName}
                placeholder={$_("grocery.addName")}
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                onkeydown={handleAddKeydown}
              />
            </label>
            <label class="w-24 shrink-0">
              <span class="sr-only">{$_("grocery.addQuantity")}</span>
              <input
                type="text"
                bind:value={newItemQuantity}
                placeholder={$_("grocery.addQuantity")}
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                onkeydown={handleAddKeydown}
              />
            </label>
            <button
              type="submit"
              class="rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-orange-600 disabled:opacity-50"
              disabled={!newItemName.trim()}
            >
              {$_("grocery.addConfirm")}
            </button>
            <button
              type="button"
              class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              onclick={cancelAdding}
            >
              {$_("grocery.addCancel")}
            </button>
          </form>
        {/if}

        {#if group.items.length > 0}
          <ul class="mt-3 space-y-2">
            {#each group.items as item (item.name)}
              {@const checked = isGroceryChecked(item.name, $groceryListState)}
              <li class="flex items-start gap-3">
                <label class="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    class="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                    checked={checked}
                    onchange={() => toggleGroceryChecked(item.name)}
                  />
                  <span
                    class="text-sm text-slate-700 {checked
                      ? 'line-through text-slate-400'
                      : ''}"
                  >
                    <span class="text-slate-500">{formatGroceryQuantities(item.quantities)}</span>
                    {item.name}
                  </span>
                </label>
                <button
                  type="button"
                  class="shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label={$_("grocery.remove")}
                  onclick={() => removeGroceryItem(item.name)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-4">
                    <path
                      d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
                    />
                  </svg>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/each}
  </div>

  {#if removedItems.length > 0}
    <div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div class="flex items-center justify-between gap-2">
        <h3 class="text-sm font-medium text-slate-600">
          {$_("grocery.removed")}
        </h3>
        <button
          type="button"
          class="text-sm font-medium text-orange-600 transition hover:text-orange-700"
          onclick={restoreAllGroceryItems}
        >
          {$_("grocery.restoreAll")}
        </button>
      </div>
      <ul class="mt-2 space-y-2">
        {#each removedItems as item (item.name)}
          <li class="flex items-center justify-between gap-3">
            <span class="min-w-0 truncate text-sm text-slate-500">
              <span class="text-slate-400">{formatGroceryQuantities(item.quantities)}</span>
              {item.name}
            </span>
            <button
              type="button"
              class="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              onclick={() => restoreGroceryItem(item.name)}
            >
              {$_("grocery.undo")}
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</section>
