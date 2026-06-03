import type { DurationTag } from "../types";

const LABELS: Record<DurationTag, string> = {
  short: "Short",
  medium: "Medium",
  long: "Long",
};

export function durationLabel(duration: DurationTag): string {
  return LABELS[duration];
}
