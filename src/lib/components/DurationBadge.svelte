<script lang="ts">
  import type { DurationTag } from "../types";
  import { durationLabel } from "../utils/duration";

  interface Props {
    duration: DurationTag;
  }

  let { duration }: Props = $props();

  const colors: Record<DurationTag, string> = {
    short: "bg-emerald-100 text-emerald-800",
    medium: "bg-amber-100 text-amber-800",
    long: "bg-rose-100 text-rose-800",
  };
</script>

<span
  class="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium {colors[
    duration
  ]}"
>
  {durationLabel(duration)}
</span>
