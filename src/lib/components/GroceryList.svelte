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
    toggleGroceryItemToVerify,
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
    editingItem = item;
    editName = item.name;
    editQuantity = formatGroceryQuantities(item.quantities);
  }

  function cancelEditing() {
    editingItem = null;
  }

  function commitEdit(toVerify: boolean) {
    if (!editingItem || !editName.trim()) return;
    editGroceryItem(editingItem.dbId, editName, editingItem.category, editQuantity, toVerify);
    cancelEditing();
  }

  function submitEdit() {
    commitEdit(editingItem?.toVerify ?? false);
  }

  function submitToVerify() {
    commitEdit(!(editingItem?.toVerify ?? false));
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

  function handleCheckboxChange(item: DisplayItem, event: Event) {
    if (item.toVerify) {
      // Tapping a to-verify row only clears the flag; reset the native
      // checkbox back since the browser already flipped it on click.
      (event.currentTarget as HTMLInputElement).checked = item.checked;
      const qty = formatGroceryQuantities(item.quantities);
      toggleGroceryItemToVerify(item.name, qty, item.category, false);
      return;
    }
    handleToggleChecked(item);
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
    <h2 class="shrink-0 font-display text-[clamp(1.4rem,5vw+0.4rem,1.75rem)] font-bold tracking-[-0.015em] text-ink">
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
            class="shrink-0 rounded-pill border px-3 py-1.5 text-[0.8125rem] font-semibold whitespace-nowrap transition disabled:opacity-50
              {active
              ? 'border-accent bg-accent text-surface hover:bg-accent-deep'
              : 'border-rule bg-surface text-ink-2 hover:border-rule-strong hover:bg-paper-2'}"
          >
            {preset.name}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  {#if allDisplayItems.length === 0}
    <p class="mb-4 rounded-card border-[1.5px] border-dashed border-rule p-6 text-center text-sm text-ink-3">
      {$_("grocery.empty")}
    </p>
  {/if}

  <div>
    {#each groupedItems as group (group.category)}
      <div class="mb-6">
        <div class="mb-2 flex items-center justify-between gap-2">
          <h3 class="font-body text-xs font-bold tracking-[0.06em] text-accent-deep uppercase">
            {$_(`grocery.category.${group.category}`)}
          </h3>
          <button
            type="button"
            class="flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-accent text-accent-deep transition hover:bg-accent-tint"
            aria-label={$_("grocery.add")}
            onclick={() => startAdding(group.category)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-[15px]">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        {#if addingCategory === group.category}
          <form
            class="mb-2 flex flex-col gap-2 rounded-card border border-rule bg-paper-2 p-3"
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
                  class="w-full min-w-0 rounded-input border border-rule bg-surface px-3 py-2.5 font-body text-[0.9375rem] text-ink placeholder:text-ink-3 focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
                  onkeydown={handleAddKeydown}
                />
              </label>
              <label class="w-22 shrink-0">
                <span class="sr-only">{$_("grocery.addQuantity")}</span>
                <input
                  type="text"
                  bind:value={newItemQuantity}
                  placeholder={$_("grocery.addQuantity")}
                  class="w-full min-w-0 rounded-input border border-rule bg-surface px-3 py-2.5 font-body text-[0.9375rem] text-ink placeholder:text-ink-3 focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
                  onkeydown={handleAddKeydown}
                />
              </label>
            </div>
            <div class="flex justify-end gap-2">
              <button
                type="button"
                class="rounded-pill border border-rule bg-transparent px-4 py-2.5 text-[0.8125rem] font-semibold text-ink-2 transition hover:border-rule-strong hover:bg-surface"
                onclick={cancelAdding}
              >
                {$_("grocery.addCancel")}
              </button>
              <button
                type="submit"
                class="rounded-pill bg-accent px-4 py-2.5 text-[0.8125rem] font-semibold text-surface shadow-btn-cast transition hover:-translate-y-px hover:bg-accent-deep active:translate-y-0 active:shadow-none disabled:pointer-events-none disabled:opacity-50"
                disabled={!newItemName.trim()}
              >
                {$_("grocery.addConfirm")}
              </button>
            </div>
          </form>
        {/if}

        {#if group.items.length > 0}
          <ul class="m-0 list-none p-0">
            {#each group.items as item (item.name)}
              {@const isEditing = editingItem?.name === item.name}
              <li animate:flip={{ duration: 250 }}>
                {#if isEditing}
                  <form
                    class="mb-2 flex flex-col gap-2 rounded-card border-[1.5px] border-accent bg-paper-2 p-3 shadow-[0_0_0_3px_var(--color-accent-tint)]"
                    onsubmit={(event) => { event.preventDefault(); submitEdit(); }}
                  >
                    <div class="flex gap-2">
                      <label class="min-w-0 flex-1">
                        <span class="sr-only">{$_("grocery.addName")}</span>
                        <input
                          type="text"
                          bind:value={editName}
                          placeholder={$_("grocery.addName")}
                          class="w-full min-w-0 rounded-input border border-rule bg-surface px-3 py-2.5 font-body text-[0.9375rem] text-ink focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
                          onkeydown={handleEditKeydown}
                        />
                      </label>
                      <label class="w-22 shrink-0">
                        <span class="sr-only">{$_("grocery.addQuantity")}</span>
                        <input
                          type="text"
                          bind:value={editQuantity}
                          placeholder={$_("grocery.addQuantity")}
                          class="w-full min-w-0 rounded-input border border-rule bg-surface px-3 py-2.5 font-body text-[0.9375rem] text-ink focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
                          onkeydown={handleEditKeydown}
                        />
                      </label>
                    </div>
                    {#if editingItem && editingItem.mealNames.length > 0}
                      <p class="flex items-center gap-1.5 text-[0.8125rem] text-ink-2">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-[13px] shrink-0 text-ink-3">
                          <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" />
                        </svg>
                        {editingItem.mealNames.join(" · ")}
                      </p>
                    {/if}
                    <div class="mt-0.5 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        class="mr-auto rounded-pill border border-warn bg-transparent px-4 py-2.5 text-[0.8125rem] font-semibold text-warn transition hover:bg-warn-tint disabled:pointer-events-none disabled:opacity-50"
                        disabled={!editName.trim()}
                        onclick={submitToVerify}
                      >
                        {editingItem?.toVerify ? $_("grocery.removeToVerify") : $_("grocery.toVerify")}
                      </button>
                      <button
                        type="button"
                        class="rounded-pill border border-rule bg-transparent px-4 py-2.5 text-[0.8125rem] font-semibold text-ink-2 transition hover:border-rule-strong hover:bg-surface"
                        onclick={cancelEditing}
                      >
                        {$_("grocery.addCancel")}
                      </button>
                      <button
                        type="submit"
                        class="rounded-pill bg-accent px-4 py-2.5 text-[0.8125rem] font-semibold text-surface shadow-btn-cast transition hover:-translate-y-px hover:bg-accent-deep active:translate-y-0 active:shadow-none disabled:pointer-events-none disabled:opacity-50"
                        disabled={!editName.trim()}
                      >
                        {$_("grocery.editConfirm")}
                      </button>
                    </div>
                  </form>
                {:else}
                  <div class="flex items-center gap-2 py-[0.55rem]">
                    <label
                      class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 select-none"
                      use:longpress={{ onLongPress: () => startEditing(item) }}
                    >
                      <input
                        type="checkbox"
                        class="sr-only"
                        checked={item.checked}
                        onchange={(event) => handleCheckboxChange(item, event)}
                      />
                      <span
                        class="flex size-[21px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] transition
                          {item.checked ? 'border-accent bg-accent text-surface' : 'border-rule-strong bg-surface text-surface'}"
                      >
                        {#if item.checked}
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="size-[13px]">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        {/if}
                      </span>
                      <span class="shrink-0 rounded-[6px] border border-rule bg-paper-2 px-[0.45rem] py-[0.1rem] font-body text-xs font-bold whitespace-nowrap text-ink-2 tabular-nums transition {item.checked ? 'opacity-55' : ''}">
                        {formatGroceryQuantities(item.quantities)}
                      </span>
                      <span class="min-w-0 [overflow-wrap:anywhere] text-[0.9375rem] {item.toVerify ? 'text-warn' : item.checked ? 'text-ink-3 line-through' : 'text-ink'}">
                        {item.name}
                      </span>
                    </label>
                    {#if item.toVerify}
                      <span class="shrink-0 rounded-pill bg-warn-tint px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap text-warn uppercase tracking-wide">
                        {$_("grocery.toVerify")}
                      </span>
                    {/if}
                    <button
                      type="button"
                      class="flex size-7 shrink-0 items-center justify-center rounded-icon text-ink-3 transition hover:bg-danger-tint hover:text-danger"
                      aria-label={$_("grocery.remove")}
                      onclick={() => handleRemove(item)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="size-[14px]">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/each}
  </div>
</section>
