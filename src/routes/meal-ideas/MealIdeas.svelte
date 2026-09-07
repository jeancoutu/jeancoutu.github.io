<script lang="ts">
  import { _ } from "svelte-i18n";
  import { mealIdeas, addIdea, updateIdea, deleteIdeaById } from "../../lib/stores/mealIdeas.svelte";

  let draft = $state("");
  let saving = $state(false);
  let error = $state("");
  let editingId = $state<string | null>(null);
  let editDraft = $state("");

  type Segment = { text: string; href: string | null };

  // Split free text into plain runs and tappable URL runs. A fresh regex per
  // call keeps `lastIndex` from leaking between renders.
  function linkify(text: string): Segment[] {
    const pattern = /(https?:\/\/[^\s]+)/g;
    const segments: Segment[] = [];
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      if (start > cursor) segments.push({ text: text.slice(cursor, start), href: null });
      segments.push({ text: match[0], href: match[0] });
      cursor = start + match[0].length;
    }
    if (cursor < text.length) segments.push({ text: text.slice(cursor), href: null });
    return segments;
  }

  async function submitIdea() {
    const text = draft.trim();
    if (!text || saving) return;
    saving = true;
    error = "";
    try {
      await addIdea(text);
      draft = "";
    } catch {
      error = $_("mealIdeas.errors.save");
    } finally {
      saving = false;
    }
  }

  function startEdit(id: string, text: string) {
    editingId = id;
    editDraft = text;
    error = "";
  }

  function cancelEdit() {
    editingId = null;
    editDraft = "";
  }

  async function saveEdit(id: string) {
    const text = editDraft.trim();
    if (!text) return;
    try {
      await updateIdea(id, text);
      editingId = null;
      editDraft = "";
    } catch {
      error = $_("mealIdeas.errors.save");
    }
  }

  async function removeIdea(id: string) {
    error = "";
    try {
      await deleteIdeaById(id);
    } catch {
      error = $_("mealIdeas.errors.delete");
    }
  }
</script>

<div>
  <header class="mb-4">
    <h1 class="m-0 mb-1 font-display text-[clamp(1.4rem,5vw+0.4rem,1.75rem)] font-bold tracking-[-0.015em] text-ink">{$_("mealIdeas.title")}</h1>
    <p class="m-0 text-sm leading-[1.45] text-ink-2">{$_("mealIdeas.subtitle")}</p>
  </header>

  {#if error}
    <p class="mb-4 rounded-input border border-danger bg-danger-tint px-3 py-2 text-sm text-danger">
      {error}
    </p>
  {/if}

  <form
    class="mb-6 flex gap-2"
    onsubmit={(event) => {
      event.preventDefault();
      submitIdea();
    }}
  >
    <label class="min-w-0 flex-1">
      <span class="sr-only">{$_("mealIdeas.placeholder")}</span>
      <textarea
        bind:value={draft}
        maxlength={1000}
        rows={2}
        placeholder={$_("mealIdeas.placeholder")}
        class="w-full resize-y rounded-input border border-rule bg-surface px-3.5 py-2.5 font-body text-[0.9375rem] text-ink placeholder:text-ink-3 focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
      ></textarea>
    </label>
    <button
      type="submit"
      disabled={!draft.trim() || saving}
      class="h-fit shrink-0 rounded-pill bg-accent px-4 py-2.5 text-sm font-semibold text-surface shadow-btn-cast transition hover:-translate-y-px hover:bg-accent-deep active:translate-y-0 active:shadow-none disabled:pointer-events-none disabled:opacity-50"
    >
      {$_("mealIdeas.add")}
    </button>
  </form>

  {#if mealIdeas.all.length === 0}
    <p class="rounded-card border-[1.5px] border-dashed border-rule p-6 text-center text-sm text-ink-3">
      {$_("mealIdeas.empty")}
    </p>
  {:else}
    <div>
      {#each mealIdeas.all as idea (idea.id)}
        <div class="flex items-start gap-2 border-b border-rule py-[0.85rem] last:border-b-0">
          {#if editingId === idea.id}
            <div class="min-w-0 flex-1">
              <textarea
                bind:value={editDraft}
                maxlength={1000}
                rows={3}
                aria-label={$_("mealIdeas.edit")}
                class="w-full resize-y rounded-input border border-rule bg-surface px-3.5 py-2.5 font-body text-[0.9375rem] text-ink focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
              ></textarea>
              <div class="mt-2 flex gap-2">
                <button
                  type="button"
                  onclick={() => saveEdit(idea.id)}
                  disabled={!editDraft.trim()}
                  class="shrink-0 rounded-pill bg-accent px-3 py-1.5 text-sm font-semibold text-surface transition hover:bg-accent-deep disabled:pointer-events-none disabled:opacity-50"
                >
                  {$_("mealIdeas.save")}
                </button>
                <button
                  type="button"
                  onclick={cancelEdit}
                  class="shrink-0 rounded-pill border border-rule px-3 py-1.5 text-sm font-semibold text-ink-2 transition hover:bg-paper-2"
                >
                  {$_("mealIdeas.cancel")}
                </button>
              </div>
            </div>
          {:else}
            <div
              role="button"
              tabindex="0"
              onclick={() => startEdit(idea.id, idea.text)}
              onkeydown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  startEdit(idea.id, idea.text);
                }
              }}
              class="min-w-0 flex-1 cursor-text rounded-input px-1 py-1 text-left text-[0.9375rem] leading-[1.5] break-words whitespace-pre-wrap text-ink transition hover:bg-paper-2"
            >
              {#each linkify(idea.text) as segment, index (index)}{#if segment.href}<a
                    href={segment.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onclick={(event) => event.stopPropagation()}
                    class="text-accent-deep underline">{segment.text}</a>{:else}{segment.text}{/if}{/each}
            </div>
          {/if}
          <button
            type="button"
            onclick={() => removeIdea(idea.id)}
            class="flex size-[1.9rem] shrink-0 items-center justify-center rounded-icon text-ink-3 transition hover:bg-danger-tint hover:text-danger"
            aria-label={$_("mealIdeas.delete")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-[15px]">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6h14z" />
            </svg>
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>
