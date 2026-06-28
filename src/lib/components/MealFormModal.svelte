<script lang="ts">
  import { _ } from "svelte-i18n";
  import Modal from "./Modal.svelte";
  import IngredientSearch from "./IngredientSearch.svelte";
  import { addMeal, updateMealById } from "../stores/meals";
  import type { DayKey, DurationTag, IngredientCategory, Meal } from "../types";
  import { DAYS } from "../types";
  import { getIngredientCategory } from "../../data/ingredientCategories";

  interface Props {
    open: boolean;
    meal?: Meal;
    onclose: () => void;
  }

  let { open, meal, onclose }: Props = $props();

  const durations: DurationTag[] = ["short", "medium", "long"];
  const titleKey = $derived(meal ? "meals.edit.title" : "meals.create.title");
  const submitKey = $derived(meal ? "meals.edit.submit" : "meals.create.submit");

  let name = $state("");
  let duration = $state<DurationTag>("short");
  let url = $state("");
  let ingredientRows = $state<{ name: string; quantity: string; category: IngredientCategory }[]>([]);
  let instructions = $state("");
  let selectedDays = $state<DayKey[]>(DAYS.map((day) => day.key));
  let error = $state("");

  $effect(() => {
    if (!open) return;

    if (meal) {
      loadMeal(meal);
    } else {
      resetForm();
    }
  });

  function resetForm() {
    name = "";
    duration = "short";
    url = "";
    ingredientRows = [];
    instructions = "";
    selectedDays = DAYS.map((day) => day.key);
    error = "";
  }

  function loadMeal(mealToEdit: Meal) {
    name = mealToEdit.name;
    duration = mealToEdit.duration;
    url = mealToEdit.url;
    ingredientRows = mealToEdit.ingredients.map((ing) => ({
      name: ing.name,
      quantity: ing.quantity,
      category: getIngredientCategory(ing.name) ?? ing.category,
    }));
    instructions = mealToEdit.instructions.join("\n");
    selectedDays = mealToEdit.supperDays;
    error = "";
  }

  function close() {
    onclose();
  }

  function toggleDay(day: DayKey) {
    selectedDays = selectedDays.includes(day)
      ? selectedDays.filter((selectedDay) => selectedDay !== day)
      : [...selectedDays, day];
  }

  let saving = $state(false);

  async function saveMeal() {
    const parsedInstructions = instructions
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!name.trim()) {
      error = $_("meals.create.errors.name");
      return;
    }

    if (ingredientRows.length === 0) {
      error = $_("meals.create.errors.ingredients");
      return;
    }

    if (parsedInstructions.length === 0) {
      error = $_("meals.create.errors.instructions");
      return;
    }

    const mealInput = {
      name: name.trim(),
      duration,
      supperDays: selectedDays,
      url: url.trim(),
      ingredients: ingredientRows,
      instructions: parsedInstructions,
    };

    saving = true;
    try {
      if (meal) {
        await updateMealById(meal.id, mealInput);
      } else {
        await addMeal(mealInput);
      }
      close();
    } catch {
      error = $_("meals.create.errors.save");
    } finally {
      saving = false;
    }
  }
</script>

<Modal open={open} title={$_(titleKey)} onclose={close}>
  {#snippet footer()}
    <button
      type="button"
      onclick={close}
      class="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
    >
      {$_("meals.create.cancel")}
    </button>
    <button
      type="button"
      onclick={saveMeal}
      disabled={saving}
      class="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50"
    >
      {$_(submitKey)}
    </button>
  {/snippet}
  <form
    class="space-y-4"
    onsubmit={(event) => {
      event.preventDefault();
      saveMeal();
    }}
  >
    {#if error}
      <p class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    {/if}

    <label class="block">
      <span class="mb-1 block text-sm font-medium text-slate-700">{$_("meals.create.name")}</span>
      <input
        type="text"
        bind:value={name}
        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
        placeholder={$_("meals.create.namePlaceholder")}
      />
    </label>

    <label class="block">
      <span class="mb-1 block text-sm font-medium text-slate-700">{$_("meals.create.duration")}</span>
      <select
        bind:value={duration}
        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
      >
        {#each durations as value}
          <option value={value}>{$_(`duration.${value}`)}</option>
        {/each}
      </select>
    </label>

    <label class="block">
      <span class="mb-1 block text-sm font-medium text-slate-700">{$_("meals.create.url")}</span>
      <input
        type="url"
        bind:value={url}
        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
        placeholder="https://example.com/recipe"
      />
    </label>

    <fieldset class="space-y-2">
      <legend class="text-sm font-medium text-slate-700">{$_("meals.create.days")}</legend>
      <div class="grid grid-cols-2 gap-2">
        {#each DAYS as day}
          <label class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={selectedDays.includes(day.key)}
              onchange={() => toggleDay(day.key)}
              class="size-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
            />
            <span>{$_(`day.${day.key}`)}</span>
          </label>
        {/each}
      </div>
    </fieldset>

    <fieldset class="space-y-2">
      <legend class="mb-1 text-sm font-medium text-slate-700">{$_("meals.create.ingredients")}</legend>
      {#if ingredientRows.length > 0}
        <ul class="space-y-1">
          {#each ingredientRows as row, i}
            <li class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <span class="flex-1 truncate text-sm text-slate-800">{row.name}</span>
              <input
                type="text"
                bind:value={row.quantity}
                class="w-16 rounded border border-slate-300 bg-white px-2 py-1 text-center text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
              <button
                type="button"
                onclick={() => (ingredientRows = ingredientRows.filter((_, j) => j !== i))}
                class="text-slate-400 transition hover:text-red-500"
                aria-label="Remove"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
      <IngredientSearch onAdd={(ing) => (ingredientRows = [...ingredientRows, { ...ing, quantity: "1" }])} />
    </fieldset>

    <label class="block">
      <span class="mb-1 block text-sm font-medium text-slate-700">{$_("meals.create.instructions")}</span>
      <textarea
        bind:value={instructions}
        rows={5}
        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
        placeholder={$_("meals.create.instructionsPlaceholder")}
      ></textarea>
      <p class="mt-1 text-xs text-slate-500">{$_("meals.create.instructionsHint")}</p>
    </label>
  </form>
</Modal>
