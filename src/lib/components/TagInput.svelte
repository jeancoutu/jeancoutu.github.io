<script lang="ts">
  import { _ } from "svelte-i18n";
  import { meals } from "../stores/meals.svelte";

  interface Props {
    tags: string[];
    onAdd: (tag: string) => void;
    onRemove: (tag: string) => void;
  }

  let { tags, onAdd, onRemove }: Props = $props();

  let query = $state("");
  let focused = $state(false);

  const allTags = $derived.by(() => {
    const set = new Set<string>();
    for (const meal of meals.all) {
      for (const tag of meal.tags) set.add(tag);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  });

  type Suggestion = { name: string; isNew: boolean };

  const suggestions = $derived.by<Suggestion[]>(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    const matches = allTags
      .filter((tag) => tag.includes(trimmed) && !tags.includes(tag))
      .map((tag) => ({ name: tag, isNew: false }));

    const isExisting = allTags.includes(trimmed) || tags.includes(trimmed);
    return isExisting ? matches : [...matches, { name: trimmed, isNew: true }];
  });

  function addTag(name: string) {
    onAdd(name);
    query = "";
  }

  function selectSuggestion(suggestion: Suggestion) {
    addTag(suggestion.name);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      const trimmed = query.trim();
      if (trimmed) addTag(trimmed);
    }
  }
</script>

<div class="space-y-2">
  <div class="relative">
    <input
      type="text"
      bind:value={query}
      onfocus={() => (focused = true)}
      onblur={() => (focused = false)}
      onkeydown={handleKeydown}
      placeholder={$_("meals.create.tagInput.placeholder")}
      class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
      autocomplete="off"
    />

    {#if focused && suggestions.length > 0}
      <ul class="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
        {#each suggestions as suggestion (suggestion.name)}
          <li>
            <button
              type="button"
              onmousedown={(e) => {
                e.preventDefault();
                selectSuggestion(suggestion);
              }}
              class={[
                "w-full px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 active:bg-slate-100",
                suggestion.isNew ? "border-t border-slate-100 text-orange-600 font-medium" : "text-slate-800",
              ].join(" ")}
            >
              {#if suggestion.isNew}
                {$_("meals.create.tagInput.createNew", { values: { name: suggestion.name } })}
              {:else}
                {suggestion.name}
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  {#if tags.length > 0}
    <div class="flex flex-wrap gap-2">
      {#each tags as tag (tag)}
        <span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          {tag}
          <button
            type="button"
            onclick={() => onRemove(tag)}
            aria-label={$_("meals.create.tagInput.remove", { values: { name: tag } })}
            class="text-slate-400 hover:text-slate-600"
          >
            ×
          </button>
        </span>
      {/each}
    </div>
  {/if}
</div>
