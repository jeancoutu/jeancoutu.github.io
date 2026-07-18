<script lang="ts">
  import { _ } from "svelte-i18n";
  import type { DurationTag } from "../types";

  interface Props {
    duration: DurationTag;
  }

  let { duration }: Props = $props();

  const colors: Record<DurationTag, string> = {
    short: "bg-badge-easy-tint text-badge-easy",
    medium: "bg-badge-mid-tint text-badge-mid",
    long: "bg-badge-hard-tint text-badge-hard",
  };
</script>

<span
  class="inline-block rounded-pill px-2.5 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap {colors[
    duration
  ]}"
>
  {$_("duration." + duration)}
</span>
