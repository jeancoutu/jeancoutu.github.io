<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { auth } from '../stores/auth.svelte';
  import { signInWithGoogle, signInWithPassword } from '../auth';

  let { children } = $props();

  let error = $state('');
  let loading = $state(false);
  let devEmail = $state('');
  let devPassword = $state('');

  async function handleSignIn() {
    error = '';
    loading = true;
    try {
      await signInWithGoogle();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      loading = false;
    }
  }

  async function handleDevSignIn() {
    error = '';
    loading = true;
    try {
      await signInWithPassword(devEmail, devPassword);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      loading = false;
    }
  }
</script>

{#if auth.loading}
  <div class="flex min-h-screen items-center justify-center bg-paper-2">
    <div class="h-6 w-6 animate-spin rounded-full border-2 border-rule border-t-accent"></div>
  </div>
{:else if auth.session}
  {@render children()}
{:else}
  <div class="flex min-h-screen flex-col justify-center gap-6 bg-paper px-6 py-8">
    <div class="flex gap-1.5" aria-hidden="true">
      {#each Array(7) as _unused, day (day)}
        <div class="aspect-square w-[15%] rounded-[7px] border {day === 2 ? 'border-accent bg-accent' : 'border-rule bg-paper-2'}"></div>
      {/each}
    </div>
    <div>
      <h1 class="font-display text-3xl font-bold tracking-tight text-ink">{$_('app.title')}</h1>
      <p class="mt-2.5 max-w-[30ch] text-sm leading-relaxed text-ink-2">
        {$_('auth.subtitle')}
      </p>
    </div>
    <div class="flex flex-col gap-2.5">
      <button
        onclick={handleSignIn}
        disabled={loading}
        class="flex items-center gap-3 rounded-pill border border-rule bg-surface py-3 pl-[18px] text-sm font-semibold text-ink transition hover:bg-paper-2 disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" class="h-[19px] w-[19px] shrink-0" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {loading ? $_('auth.redirecting') : $_('auth.signInGoogle')}
      </button>
      {#if error}
        <p class="text-sm text-danger">{error}</p>
      {/if}
      {#if import.meta.env.DEV}
        <div class="mt-2 flex flex-col gap-2 border-t border-rule pt-4">
          <p class="text-xs text-ink-3">{$_('auth.devLogin')}</p>
          <input
            bind:value={devEmail}
            type="email"
            placeholder={$_('auth.emailPlaceholder')}
            class="rounded-input border border-rule bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
          />
          <input
            bind:value={devPassword}
            type="password"
            placeholder={$_('auth.passwordPlaceholder')}
            class="rounded-input border border-rule bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:ring-3 focus:ring-accent-tint focus:outline-none"
          />
          <button
            onclick={handleDevSignIn}
            disabled={loading}
            class="rounded-pill bg-accent px-4 py-2.5 text-sm font-semibold text-surface shadow-btn-cast transition hover:bg-accent-deep disabled:opacity-50"
          >
            {$_('auth.signInEmail')}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
