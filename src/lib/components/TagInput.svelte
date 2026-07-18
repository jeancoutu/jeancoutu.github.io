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

<div class="flex flex-col gap-2">
  <div class="relative">
    <input
      type="text"
      bind:value={query}
      onfocus={() => (focused = true)}
      onblur={() => (focused = false)}
      onkeydown={handleKeydown}
      placeholder={$_("meals.create.tagInput.placeholder")}
      class="w-full rounded-input border border-rule bg-surface px-3.5 py-2.5 font-body text-[0.9375rem] text-ink placeholder:text-ink-3 focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
      autocomplete="off"
    />

    {#if focused && suggestions.length > 0}
      <ul class="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-input border border-rule bg-surface shadow-float">
        {#each suggestions as suggestion (suggestion.name)}
          <li>
            <button
              type="button"
              onmousedown={(e) => {
                e.preventDefault();
                selectSuggestion(suggestion);
              }}
              class={[
                "w-full px-3.5 py-2.5 text-left text-[0.9375rem] transition hover:bg-paper-2",
                suggestion.isNew ? "border-t border-rule font-semibold text-accent-deep" : "text-ink",
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
        <span class="inline-flex items-center gap-1.5 rounded-pill bg-paper-2 py-1 pr-1 pl-2.5 text-xs font-medium text-ink-2">
          {tag}
          <button
            type="button"
            onclick={() => onRemove(tag)}
            aria-label={$_("meals.create.tagInput.remove", { values: { name: tag } })}
            class="flex size-4 items-center justify-center rounded-full text-ink-3 transition hover:bg-rule hover:text-ink"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" class="size-[10px]">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </span>
      {/each}
    </div>
  {/if}
</div>
