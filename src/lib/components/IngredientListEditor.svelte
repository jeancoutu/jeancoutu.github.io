<script lang="ts">
  import { _ } from "svelte-i18n";
  import IngredientSearch from "./IngredientSearch.svelte";
  import { groupIngredientsBySection, type IngredientSectionBlock } from "../utils/ingredientSections";
  import type { Ingredient } from "../types";

  interface Props {
    legend: string;
    rows: Ingredient[];
  }

  let { legend, rows = $bindable() }: Props = $props();

  // Sections the user created but that have no ingredients yet — kept here (not in `rows`)
  // so they render as a full block (rename/delete, movable-into target) and are silently
  // dropped on save since nothing in `rows` references them.
  let pendingSections: string[] = $state([]);

  // Unsectioned is always shown, first, even with zero ingredients in it —
  // groupIngredientsBySection omits an empty unlabeled block, so it's added back here.
  const blocks = $derived.by<IngredientSectionBlock[]>(() => {
    const grouped = groupIngredientsBySection(rows, { unsectionedFirst: true });
    const result = grouped[0]?.section !== null ? [{ section: null, ingredients: [] }, ...grouped] : grouped;
    const existingKeys = new Set(result.filter((b) => b.section !== null).map((b) => b.section!.toLowerCase()));
    const pendingBlocks = pendingSections
      .filter((s) => !existingKeys.has(s.toLowerCase()))
      .map((s) => ({ section: s, ingredients: [] }));
    return [...result, ...pendingBlocks];
  });

  const sectionSuggestions = $derived.by(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      const trimmed = row.section?.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (!seen.has(key)) seen.set(key, trimmed);
    }
    for (const section of pendingSections) {
      const key = section.toLowerCase();
      if (!seen.has(key)) seen.set(key, section);
    }
    return [...seen.values()];
  });

  function focusOnMount(node: HTMLInputElement) {
    node.focus();
  }

  // Which block's inline "add ingredient" search is expanded. `addOpenKey` mirrors
  // IngredientSectionBlock.section (null = unsectioned); it may reference a
  // not-yet-existing section name while a brand-new section awaits its first ingredient.
  let addOpenActive = $state(false);
  let addOpenKey: string | null = $state(null);

  function openAdd(key: string | null) {
    addOpenActive = true;
    addOpenKey = key;
  }

  function addIngredient(ingredient: { name: string; category: Ingredient["category"] }, section: string | null) {
    rows = [...rows, { ...ingredient, quantity: "1", section }];
  }

  let addingSection = $state(false);
  let newSectionName = $state("");

  function startAddSection() {
    addingSection = true;
    newSectionName = "";
  }

  function confirmAddSection() {
    if (!addingSection) return;
    addingSection = false;
    const trimmed = newSectionName.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    const alreadyExists =
      pendingSections.some((s) => s.toLowerCase() === key) || rows.some((r) => r.section?.trim().toLowerCase() === key);
    if (!alreadyExists) {
      pendingSections = [...pendingSections, trimmed];
    }
    openAdd(trimmed);
  }

  let editingActive = $state(false);
  let editingKey: string | null = $state(null);
  let editValue = $state("");

  function startEditSection(block: IngredientSectionBlock) {
    if (block.section === null) return;
    editingActive = true;
    editingKey = block.section;
    editValue = block.section;
  }

  function commitRename(block: IngredientSectionBlock) {
    if (!editingActive || editingKey !== block.section) return;
    editingActive = false;
    const trimmed = editValue.trim();
    if (!trimmed) {
      clearSection(block);
      return;
    }
    if (trimmed !== block.section) {
      if (block.ingredients.length > 0) {
        for (const row of block.ingredients) row.section = trimmed;
      } else {
        pendingSections = pendingSections.map((s) => (s === block.section ? trimmed : s));
      }
      if (addOpenActive && addOpenKey === block.section) addOpenKey = trimmed;
    }
  }

  function clearSection(block: IngredientSectionBlock) {
    for (const row of block.ingredients) row.section = null;
    if (block.section !== null) {
      pendingSections = pendingSections.filter((s) => s !== block.section);
    }
    if (addOpenActive && addOpenKey === block.section) {
      addOpenActive = false;
      addOpenKey = null;
    }
  }

  function removeIngredient(row: Ingredient) {
    rows = rows.filter((r) => r !== row);
  }

  let moveMenuRow: Ingredient | null = $state(null);
  let moveMenuNewActive = $state(false);
  let moveNewSectionName = $state("");

  function toggleMoveMenu(row: Ingredient) {
    if (moveMenuRow === row) {
      closeMoveMenu();
    } else {
      moveMenuRow = row;
      moveMenuNewActive = false;
      moveNewSectionName = "";
    }
  }

  function closeMoveMenu() {
    moveMenuRow = null;
    moveMenuNewActive = false;
    moveNewSectionName = "";
  }

  function moveToSection(row: Ingredient, section: string | null) {
    row.section = section;
    closeMoveMenu();
  }

  function startMoveNewSection() {
    moveMenuNewActive = true;
    moveNewSectionName = "";
  }

  function confirmMoveNewSection(row: Ingredient) {
    const trimmed = moveNewSectionName.trim();
    if (trimmed) row.section = trimmed;
    closeMoveMenu();
  }
</script>

<datalist id="ingredient-section-suggestions">
  {#each sectionSuggestions as suggestion (suggestion)}
    <option value={suggestion}></option>
  {/each}
</datalist>

<fieldset class="block">
  <legend class="mb-1.5 block text-[0.8125rem] font-semibold text-ink">{legend}</legend>

  {#each blocks as block (block.section ?? "__unsectioned")}
    <div class="mb-3" role="group" aria-label={block.section ?? $_("meals.create.moveTo.unsectioned")}>
      {#if block.section !== null}
        <div class="mb-1.5 flex items-center justify-between gap-2">
          {#if editingActive && editingKey === block.section}
            <input
              type="text"
              bind:value={editValue}
              onblur={() => commitRename(block)}
              onkeydown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  editingActive = false;
                  e.currentTarget.blur();
                }
              }}
              list="ingredient-section-suggestions"
              use:focusOnMount
              class="min-w-0 flex-1 rounded-input border border-rule bg-surface px-2 py-1 font-body text-[0.75rem] font-bold tracking-[0.03em] text-ink uppercase focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
            />
          {:else}
            <button
              type="button"
              onclick={() => startEditSection(block)}
              class="min-w-0 flex-1 truncate text-left font-body text-[0.75rem] font-bold tracking-[0.03em] text-ink-3 uppercase transition hover:text-ink"
            >
              {block.section}
            </button>
          {/if}
          <button
            type="button"
            onclick={() => clearSection(block)}
            aria-label={$_("meals.create.section.remove")}
            class="flex size-6 shrink-0 items-center justify-center rounded-icon text-ink-3 transition hover:bg-danger-tint hover:text-danger"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="size-3">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      {/if}

      {#if block.ingredients.length > 0}
        <div class="mb-1.5">
          {#each block.ingredients as row (row)}
            <div class="flex items-center gap-2 border-b border-rule py-2">
              <span class="min-w-0 flex-1 [overflow-wrap:anywhere] text-[0.9375rem] text-ink">{row.name}</span>
              <input
                type="text"
                bind:value={row.quantity}
                class="w-19 shrink-0 rounded-input border border-rule bg-surface px-2.5 py-1.5 text-center font-body text-[0.8125rem] text-ink focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
              />
              <div class="relative">
                <button
                  type="button"
                  onclick={() => toggleMoveMenu(row)}
                  aria-label={$_("meals.create.moveTo.label")}
                  class="flex size-7 shrink-0 items-center justify-center rounded-icon text-ink-3 transition hover:bg-paper-2 hover:text-ink"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-[14px]">
                    <path d="M8 3L4 7l4 4" />
                    <path d="M4 7h16" />
                    <path d="M16 21l4-4-4-4" />
                    <path d="M20 17H4" />
                  </svg>
                </button>

                {#if moveMenuRow === row}
                  <button
                    type="button"
                    aria-label={$_("modal.close")}
                    onclick={closeMoveMenu}
                    class="fixed inset-0 z-20 cursor-default"
                  ></button>
                  <div
                    role="menu"
                    aria-label={$_("meals.create.moveTo.label")}
                    class="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-input border border-rule bg-surface shadow-float"
                  >
                    {#if moveMenuNewActive}
                      <input
                        type="text"
                        bind:value={moveNewSectionName}
                        onblur={() => confirmMoveNewSection(row)}
                        onkeydown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") closeMoveMenu();
                        }}
                        list="ingredient-section-suggestions"
                        placeholder={$_("meals.create.section.namePlaceholder")}
                        use:focusOnMount
                        class="w-full border-0 px-3 py-2 font-body text-[0.8125rem] text-ink focus:ring-0 focus:outline-none"
                      />
                    {:else}
                      {#each sectionSuggestions as suggestion (suggestion)}
                        <button
                          type="button"
                          role="menuitem"
                          onmousedown={(e) => {
                            e.preventDefault();
                            moveToSection(row, suggestion);
                          }}
                          class="block w-full px-3 py-2 text-left text-[0.8125rem] text-ink transition hover:bg-paper-2"
                        >
                          {suggestion}
                        </button>
                      {/each}
                      <button
                        type="button"
                        role="menuitem"
                        onmousedown={(e) => {
                          e.preventDefault();
                          moveToSection(row, null);
                        }}
                        class="block w-full border-t border-rule px-3 py-2 text-left text-[0.8125rem] text-ink transition hover:bg-paper-2"
                      >
                        {$_("meals.create.moveTo.unsectioned")}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onmousedown={(e) => {
                          e.preventDefault();
                          startMoveNewSection();
                        }}
                        class="block w-full border-t border-rule px-3 py-2 text-left text-[0.8125rem] font-semibold text-accent-deep transition hover:bg-paper-2"
                      >
                        {$_("meals.create.moveTo.newSection")}
                      </button>
                    {/if}
                  </div>
                {/if}
              </div>
              <button
                type="button"
                onclick={() => removeIngredient(row)}
                class="flex size-7 shrink-0 items-center justify-center rounded-icon text-ink-3 transition hover:bg-danger-tint hover:text-danger"
                aria-label="Remove"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="size-[14px]">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          {/each}
        </div>
      {/if}

      {#if addOpenActive && addOpenKey === block.section}
        <IngredientSearch autofocus onAdd={(ing) => addIngredient(ing, block.section)} />
      {:else}
        <button
          type="button"
          onclick={() => openAdd(block.section)}
          class="text-[0.8125rem] font-semibold text-accent-deep transition hover:text-accent"
        >
          {$_("meals.create.section.addIngredient")}
        </button>
      {/if}
    </div>
  {/each}

  {#if addOpenActive && addOpenKey !== null && !blocks.some((b) => b.section === addOpenKey)}
    <div class="mb-3">
      <div class="mb-1.5 font-body text-[0.75rem] font-bold tracking-[0.03em] text-ink-3 uppercase">{addOpenKey}</div>
      <IngredientSearch autofocus onAdd={(ing) => addIngredient(ing, addOpenKey)} />
    </div>
  {/if}

  {#if addingSection}
    <input
      type="text"
      bind:value={newSectionName}
      onblur={confirmAddSection}
      onkeydown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          addingSection = false;
          e.currentTarget.blur();
        }
      }}
      list="ingredient-section-suggestions"
      placeholder={$_("meals.create.section.namePlaceholder")}
      use:focusOnMount
      class="w-full rounded-input border border-rule bg-surface px-3.5 py-2.5 font-body text-[0.9375rem] text-ink focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
    />
  {:else}
    <button
      type="button"
      onclick={startAddSection}
      class="w-full rounded-input border-[1.5px] border-dashed border-rule-strong px-3.5 py-2.5 text-center text-[0.8125rem] font-semibold text-ink-3 transition hover:border-accent hover:bg-accent-tint hover:text-accent-deep"
    >
      {$_("meals.create.section.add")}
    </button>
  {/if}
</fieldset>
