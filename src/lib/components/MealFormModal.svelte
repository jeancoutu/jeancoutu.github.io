<script lang="ts">
  import { _ } from "svelte-i18n";
  import Modal from "./Modal.svelte";
  import { addCustomMeal } from "../stores/meals";
  import type { DayKey, DurationTag } from "../types";
  import { DAYS } from "../types";

  interface Props {
    open: boolean;
    onclose: () => void;
  }

  let { open, onclose }: Props = $props();

  const durations: DurationTag[] = ["short", "medium", "long"];

  let name = $state("");
  let duration = $state<DurationTag>("short");
  let url = $state("");
  let ingredients = $state("");
  let instructions = $state("");
  let selectedDays = $state<DayKey[]>(DAYS.map((day) => day.key));
  let error = $state("");

  function resetForm() {
    name = "";
    duration = "short";
    url = "";
    ingredients = "";
    instructions = "";
    selectedDays = DAYS.map((day) => day.key);
    error = "";
  }

  function close() {
    resetForm();
    onclose();
  }

  function toggleDay(day: DayKey) {
    selectedDays = selectedDays.includes(day)
      ? selectedDays.filter((selectedDay) => selectedDay !== day)
      : [...selectedDays, day];
  }

  function parseIngredientLine(line: string) {
    const trimmed = line.trim();
    if (!trimmed) return null;

    const match = trimmed.match(/^(.+?)\s*(?:[-–—:|])\s*(.+)$/);
    const [quantity, ingredientName] = match
      ? [match[1].trim(), match[2].trim()]
      : ["1", trimmed];

    if (!ingredientName) return null;

    return {
      name: ingredientName,
      quantity,
    };
  }

  function parseIngredients() {
    return ingredients
      .split("\n")
      .map(parseIngredientLine)
      .filter((item): item is { name: string; quantity: string } => item !== null);
  }

  function createMeal() {
    const parsedIngredients = parseIngredients();
    const parsedInstructions = instructions
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!name.trim()) {
      error = $_("meals.create.errors.name");
      return;
    }

    if (parsedIngredients.length === 0) {
      error = $_("meals.create.errors.ingredients");
      return;
    }

    if (parsedInstructions.length === 0) {
      error = $_("meals.create.errors.instructions");
      return;
    }

    const meal = addCustomMeal({
      name: name.trim(),
      duration,
      supperDays: selectedDays,
      url: url.trim(),
      ingredients: parsedIngredients,
      instructions: parsedInstructions,
    });

    close();
    return meal;
  }

</script>

<Modal open={open} title={$_("meals.create.title")} onclose={close}>
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
      onclick={createMeal}
      class="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-orange-600 active:bg-orange-700"
    >
      {$_("meals.create.submit")}
    </button>
  {/snippet}
  <form
    class="space-y-4"
    onsubmit={(event) => {
      event.preventDefault();
      createMeal();
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

    <label class="block">
      <span class="mb-1 block text-sm font-medium text-slate-700">{$_("meals.create.ingredients")}</span>
      <textarea
        bind:value={ingredients}
        rows={5}
        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
        placeholder={$_("meals.create.ingredientsPlaceholder")}
      ></textarea>
      <p class="mt-1 text-xs text-slate-500">{$_("meals.create.ingredientsHint")}</p>
    </label>

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
