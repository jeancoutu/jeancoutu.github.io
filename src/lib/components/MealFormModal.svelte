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

  function buildInitialForm() {
    return meal
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
  }

  let name = $state("");
  let duration = $state<DurationTag>("short");
  let url = $state("");
  let ingredientRows = $state<{ name: string; quantity: string; category: IngredientCategory }[]>([]);
  let instructions = $state("");
  let selectedDays = $state<DayKey[]>([]);
  let tags = $state<string[]>([]);
  let error = $state("");

  // The component stays mounted while closed (for a smoother open animation),
  // so the form must reset itself on every open transition rather than relying
  // on a fresh mount.
  let wasOpen = false;
  $effect(() => {
    if (open && !wasOpen) {
      const form = buildInitialForm();
      name = form.name;
      duration = form.duration;
      url = form.url;
      ingredientRows = form.ingredientRows;
      instructions = form.instructions;
      selectedDays = form.selectedDays;
      tags = form.tags;
      error = "";
    }
    wasOpen = open;
  });

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
      class="rounded-pill border border-rule bg-transparent px-4 py-2.5 text-sm font-semibold text-ink-2 transition hover:border-rule-strong hover:bg-paper-2"
    >
      {$_("meals.create.cancel")}
    </button>
    <button
      type="button"
      onclick={saveMeal}
      disabled={saving}
      class="rounded-pill bg-accent px-4 py-2.5 text-sm font-semibold text-surface shadow-btn-cast transition hover:-translate-y-px hover:bg-accent-deep active:translate-y-0 active:shadow-none disabled:pointer-events-none disabled:opacity-50"
    >
      {$_(submitKey)}
    </button>
  {/snippet}
  <form
    class="flex flex-col gap-4"
    onsubmit={(event) => {
      event.preventDefault();
      saveMeal();
    }}
  >
    {#if error}
      <p class="rounded-input border border-danger bg-danger-tint px-3 py-2 text-sm text-danger">
        {error}
      </p>
    {/if}

    <label class="block">
      <span class="mb-1.5 block text-[0.8125rem] font-semibold text-ink">{$_("meals.create.name")}</span>
      <input
        type="text"
        bind:value={name}
        maxlength={50}
        class="w-full rounded-input border border-rule bg-surface px-3.5 py-2.5 font-body text-[0.9375rem] text-ink placeholder:text-ink-3 focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
        placeholder={$_("meals.create.namePlaceholder")}
      />
    </label>

    <label class="block">
      <span class="mb-1.5 block text-[0.8125rem] font-semibold text-ink">{$_("meals.create.duration")}</span>
      <select
        bind:value={duration}
        class="w-full appearance-none rounded-input border border-rule bg-surface bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23606b73%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:15px] bg-[right_0.85rem_center] bg-no-repeat px-3.5 py-2.5 pr-10 font-body text-[0.9375rem] text-ink focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
      >
        {#each durations as value (value)}
          <option {value}>{$_(`duration.${value}`)}</option>
        {/each}
      </select>
    </label>

    <label class="block">
      <span class="mb-1.5 block text-[0.8125rem] font-semibold text-ink">{$_("meals.create.url")}</span>
      <input
        type="url"
        bind:value={url}
        class="w-full rounded-input border border-rule bg-surface px-3.5 py-2.5 font-body text-[0.9375rem] text-ink placeholder:text-ink-3 focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
        placeholder="https://example.com/recipe"
      />
    </label>

    <fieldset class="block">
      <legend class="mb-1.5 block text-[0.8125rem] font-semibold text-ink">{$_("meals.create.days")}</legend>
      <div class="grid grid-cols-2 gap-2">
        {#each DAYS as day (day.key)}
          {@const checked = selectedDays.includes(day.key)}
          <label class="flex cursor-pointer items-center gap-2.5 rounded-input border px-3.5 py-2.5 text-[0.9375rem] text-ink transition
            {checked ? 'border-accent bg-accent-tint' : 'border-rule hover:border-rule-strong'}">
            <input
              type="checkbox"
              checked={selectedDays.includes(day.key)}
              onchange={() => toggleDay(day.key)}
              class="sr-only"
            />
            <span class="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition
              {checked ? 'border-accent bg-accent text-surface' : 'border-rule-strong bg-surface text-surface'}">
              {#if checked}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="size-[11px]">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              {/if}
            </span>
            {$_(`day.${day.key}`)}
          </label>
        {/each}
      </div>
    </fieldset>

    <IngredientListEditor legend={$_("meals.create.ingredients")} bind:rows={ingredientRows} />

    <label class="block">
      <span class="mb-1.5 block text-[0.8125rem] font-semibold text-ink">{$_("meals.create.instructions")}</span>
      <textarea
        bind:value={instructions}
        rows={5}
        class="min-h-26 w-full resize-y rounded-input border border-rule bg-surface px-3.5 py-2.5 font-body text-[0.9375rem] text-ink placeholder:text-ink-3 focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
        placeholder={$_("meals.create.instructionsPlaceholder")}
      ></textarea>
      <p class="mt-1.5 text-xs text-ink-3">{$_("meals.create.instructionsHint")}</p>
    </label>

    <div class="block">
      <span class="mb-1.5 block text-[0.8125rem] font-semibold text-ink">{$_("meals.create.tags")}</span>
      <TagInput {tags} onAdd={addTag} onRemove={removeTag} />
    </div>
  </form>
</Modal>
