<script lang="ts">
  import { _ } from "svelte-i18n";
  import { flip } from "svelte/animate";
  import type { IngredientCategory } from "../types";
  import { weeklyPlan } from "../stores/weeklyPlan.svelte";
  import { getMealById } from "../stores/meals.svelte";
  import {
    addGroceryItem,
    editGroceryItem,
    groceryList,
    removeGroceryItem,
    toggleGroceryItemChecked,
  } from "../stores/groceryList.svelte";
  import {
    buildGroceryList,
    formatGroceryQuantities,
    getPlannedMeals,
    groupGroceryByCategory,
  } from "../utils/groceryList";
  import { buildDisplayItems, type DisplayItem } from "../utils/groceryDisplay";
  import { longpress } from "../utils/longpress";
  import { groceryPresets, togglePresetForWeek } from "../stores/groceryPresets.svelte";

  let plannedMeals = $derived(getPlannedMeals(weeklyPlan.current, getMealById));
  let mealPlanItems = $derived(buildGroceryList(plannedMeals));
  let dbItems = $derived(groceryList.itemsForWeek);
  let dismissed = $derived(new Set(weeklyPlan.dismissedIngredients));

  let allDisplayItems = $derived(buildDisplayItems(mealPlanItems, dbItems, dismissed));
  let groupedItems = $derived(
    groupGroceryByCategory(allDisplayItems).map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => Number(a.checked) - Number(b.checked)),
    })),
  );

  let addingCategory = $state<IngredientCategory | null>(null);
  let newItemName = $state("");
  let newItemQuantity = $state("");
  function autofocus(node: HTMLInputElement) {
    node.focus();
  }

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

  let editingItem = $state<DisplayItem | null>(null);
  let editName = $state("");
  let editQuantity = $state("");

  function startEditing(item: DisplayItem) {
    // Only allow editing items that have a DB row
    if (!item.dbId) return;
    editingItem = item;
    editName = item.name;
    editQuantity = formatGroceryQuantities(item.quantities);
  }

  function cancelEditing() {
    editingItem = null;
  }

  function submitEdit() {
    if (!editingItem?.dbId || !editName.trim()) return;
    editGroceryItem(editingItem.dbId, editName, editingItem.category, editQuantity);
    cancelEditing();
  }

  function handleEditKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      submitEdit();
    } else if (event.key === "Escape") {
      cancelEditing();
    }
  }

  function handleToggleChecked(item: DisplayItem) {
    const qty = formatGroceryQuantities(item.quantities);
    toggleGroceryItemChecked(item.name, qty, item.category, !item.checked);
  }

  function handleRemove(item: DisplayItem) {
    if (item.isCustom) {
      if (item.dbId) removeGroceryItem(item.dbId);
    } else {
      weeklyPlan.dismissIngredient(item.name, item.dbId);
    }
  }

  let togglingPresetId = $state<string | null>(null);

  async function handlePresetToggle(presetId: string) {
    if (togglingPresetId) return;
    togglingPresetId = presetId;
    try {
      await togglePresetForWeek(presetId);
    } catch (err) {
      console.error("Failed to toggle grocery preset:", err);
    } finally {
      togglingPresetId = null;
    }
  }
</script>

<section class="mt-6">
  <div class="mb-4 flex items-center gap-3">
    <h2 class="shrink-0 text-lg font-semibold text-slate-900">
      {$_("grocery.title")}
    </h2>
    {#if groceryPresets.all.length > 0}
      <div class="flex min-w-0 flex-1 gap-2 overflow-x-auto" role="group" aria-label={$_("grocery.presets.label")}>
        {#each groceryPresets.all as preset (preset.id)}
          {@const active = groceryPresets.activeForWeek.has(preset.id)}
          <button
            type="button"
            onclick={() => handlePresetToggle(preset.id)}
            disabled={togglingPresetId !== null}
            aria-pressed={active}
            class="shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-50
              {active
              ? 'border-orange-500 bg-orange-500 text-white hover:bg-orange-600'
              : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}"
          >
            {preset.name}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  {#if allDisplayItems.length === 0}
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
            class="mt-3 flex flex-col gap-2"
            onsubmit={(event) => {
              event.preventDefault();
              submitAdd();
            }}
          >
            <div class="flex gap-2">
              <label class="min-w-0 flex-1">
                <span class="sr-only">{$_("grocery.addName")}</span>
                <input
                  type="text"
                  bind:value={newItemName}
                  {@attach autofocus}
                  placeholder={$_("grocery.addName")}
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  onkeydown={handleAddKeydown}
                />
              </label>
              <label class="w-16 shrink-0">
                <span class="sr-only">{$_("grocery.addQuantity")}</span>
                <input
                  type="text"
                  bind:value={newItemQuantity}
                  placeholder={$_("grocery.addQuantity")}
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  onkeydown={handleAddKeydown}
                />
              </label>
            </div>
            <div class="flex justify-end gap-2">
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
            </div>
          </form>
        {/if}

        {#if group.items.length > 0}
          <ul class="mt-3 space-y-2">
            {#each group.items as item (item.name)}
              {@const isEditing = editingItem?.name === item.name}
              <li class="flex items-start gap-3" animate:flip={{ duration: 250 }}>
                {#if isEditing}
                  <form
                    class="flex min-w-0 flex-1 flex-col gap-2"
                    onsubmit={(event) => { event.preventDefault(); submitEdit(); }}
                  >
                    <div class="flex gap-2">
                      <label class="min-w-0 flex-1">
                        <span class="sr-only">{$_("grocery.addName")}</span>
                        <input
                          type="text"
                          bind:value={editName}
                          placeholder={$_("grocery.addName")}
                          class="w-full rounded-lg border border-orange-400 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                          onkeydown={handleEditKeydown}
                        />
                      </label>
                      <label class="w-16 shrink-0">
                        <span class="sr-only">{$_("grocery.addQuantity")}</span>
                        <input
                          type="text"
                          bind:value={editQuantity}
                          placeholder={$_("grocery.addQuantity")}
                          class="w-full rounded-lg border border-orange-400 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                          onkeydown={handleEditKeydown}
                        />
                      </label>
                    </div>
                    {#if editingItem && editingItem.mealNames.length > 0}
                      <p class="text-xs text-slate-500">
                        {editingItem.mealNames.join(" · ")}
                      </p>
                    {/if}
                    <div class="flex justify-end gap-2">
                      <button
                        type="submit"
                        class="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-orange-600 disabled:opacity-50"
                        disabled={!editName.trim()}
                      >
                        {$_("grocery.editConfirm")}
                      </button>
                      <button
                        type="button"
                        class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        onclick={cancelEditing}
                      >
                        {$_("grocery.addCancel")}
                      </button>
                    </div>
                  </form>
                {:else}
                  <label
                    class="flex min-w-0 flex-1 cursor-pointer select-none items-start gap-3"
                    use:longpress={{ onLongPress: () => startEditing(item) }}
                  >
                    <input
                      type="checkbox"
                      class="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                      checked={item.checked}
                      onchange={() => handleToggleChecked(item)}
                    />
                    <span
                      class="text-sm text-slate-700 {item.checked
                        ? 'line-through text-slate-400'
                        : ''}"
                    >
                      <span class="tabular-nums text-slate-500">{formatGroceryQuantities(item.quantities)}</span>
                      {item.name}
                    </span>
                  </label>
                  <button
                    type="button"
                    class="shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    aria-label={$_("grocery.remove")}
                    onclick={() => handleRemove(item)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-4">
                      <path
                        d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
                      />
                    </svg>
                  </button>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/each}
  </div>
</section>
