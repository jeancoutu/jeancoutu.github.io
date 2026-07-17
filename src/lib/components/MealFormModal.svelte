<script lang="ts">
  import { _ } from "svelte-i18n";
  import Modal from "./Modal.svelte";
  import IngredientListEditor from "./IngredientListEditor.svelte";
  import TagInput from "./TagInput.svelte";
  import { addMeal, updateMealById } from "../stores/meals.svelte";
  import type { DayKey, DurationTag, IngredientCategory, Meal } from "../types";
  import { DAYS } from "../types";
  import { getIngredientCategory } from "../../data/ingredientCategories";
  import { buildDuplicateName } from "../utils/duplicateMeal";

  interface Props {
    open: boolean;
    meal?: Meal | undefined;
    duplicateOf?: Meal | undefined;
    onclose: () => void;
  }

  let { open, meal, duplicateOf, onclose }: Props = $props();

  const durations: DurationTag[] = ["short", "medium", "long"];
  const titleKey = $derived(meal ? "meals.edit.title" : duplicateOf ? "meals.duplicate.title" : "meals.create.title");
  const submitKey = $derived(meal ? "meals.edit.submit" : "meals.create.submit");

  function formFromMeal(mealToLoad: Meal, nameOverride?: string) {
    return {
      name: nameOverride ?? mealToLoad.name,
      duration: mealToLoad.duration,
      url: mealToLoad.url,
      ingredientRows: mealToLoad.ingredients.map((ing) => ({
        name: ing.name,
        quantity: ing.quantity,
        category: getIngredientCategory(ing.name) ?? ing.category,
      })),
      instructions: mealToLoad.instructions.join("\n"),
      selectedDays: mealToLoad.supperDays,
      tags: mealToLoad.tags,
    };
  }

  // Snapshot the props once at mount: the caller keys this component by
  // meal/duplicateOf identity, so a new value always means a remount.
  // svelte-ignore state_referenced_locally
  const initialForm = meal
    ? formFromMeal(meal)
    : duplicateOf
      ? formFromMeal(duplicateOf, buildDuplicateName(duplicateOf.name, $_("meals.duplicate.suffix")))
      : {
          name: "",
          duration: "short" as DurationTag,
          url: "",
          ingredientRows: [] as { name: string; quantity: string; category: IngredientCategory }[],
          instructions: "",
          selectedDays: DAYS.map((day) => day.key),
          tags: [] as string[],
        };

  let name = $state(initialForm.name);
  let duration = $state<DurationTag>(initialForm.duration);
  let url = $state(initialForm.url);
  let ingredientRows = $state(initialForm.ingredientRows);
  let instructions = $state(initialForm.instructions);
  let selectedDays = $state<DayKey[]>(initialForm.selectedDays);
  let tags = $state<string[]>(initialForm.tags);
  let error = $state("");

  function close() {
    onclose();
  }

  function toggleDay(day: DayKey) {
    selectedDays = selectedDays.includes(day)
      ? selectedDays.filter((selectedDay) => selectedDay !== day)
      : [...selectedDays, day];
  }

  function addTag(tag: string) {
    const normalized = tag.trim().toLowerCase();
    if (normalized && !tags.includes(normalized)) {
      tags = [...tags, normalized];
    }
  }

  function removeTag(tag: string) {
    tags = tags.filter((existing) => existing !== tag);
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

    if (name.trim().length > 50) {
      error = $_("meals.create.errors.nameTooLong");
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
      tags,
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
        maxlength={50}
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

    <IngredientListEditor legend={$_("meals.create.ingredients")} bind:rows={ingredientRows} />

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

    <div class="block">
      <span class="mb-1 block text-sm font-medium text-slate-700">{$_("meals.create.tags")}</span>
      <TagInput {tags} onAdd={addTag} onRemove={removeTag} />
    </div>
  </form>
</Modal>
