import { describe, it, expect } from "vitest";
import { buildDuplicateName } from "../../lib/utils/duplicateMeal";

describe("buildDuplicateName", () => {
  it("appends the suffix to the name", () => {
    expect(buildDuplicateName("Tacos", " (copy)")).toBe("Tacos (copy)");
  });

  it("appends the suffix even if the name already contains it", () => {
    expect(buildDuplicateName("Tacos (copy)", " (copy)")).toBe("Tacos (copy) (copy)");
  });

  it("handles an empty name", () => {
    expect(buildDuplicateName("", " (copy)")).toBe(" (copy)");
  });
});
