import { describe, expect, it } from "vitest";
import { render, screen } from "../componentTestUtils";
import DurationBadge from "../../lib/components/DurationBadge.svelte";

describe("component test harness smoke test", () => {
  it("mounts a real component with real i18n copy", () => {
    render(DurationBadge, { duration: "short" });

    expect(screen.getByText("Short")).toBeInTheDocument();
  });
});
