import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, userEvent, resetDb, resetStores } from "../componentTestUtils";
import PresetsList from "../../routes/presets/PresetsList.svelte";
import { groceryPresets } from "../../lib/stores/groceryPresets.svelte";
import { groceryPresetRepo } from "../../lib/repos/groceryPresetRepo";
import { router } from "../../lib/utils/router.svelte";
import type { GroceryPreset } from "../../lib/types";

async function seedPreset(overrides: Partial<Omit<GroceryPreset, "id">> = {}): Promise<GroceryPreset> {
  const preset = await groceryPresetRepo.create({
    name: "Pantry staples",
    items: [{ name: "Rice", quantity: "1", category: "aisle" }],
    ...overrides,
  });
  groceryPresets.all = await groceryPresetRepo.getAll();
  return preset;
}

describe("PresetsList", () => {
  beforeEach(async () => {
    await resetDb();
    resetStores();
  });

  it("renders the empty state when there are no presets", () => {
    render(PresetsList);
    expect(screen.getByText("No grocery presets yet. Create one above to get started.")).toBeInTheDocument();
  });

  it("Create is disabled when the name is blank", () => {
    render(PresetsList);
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
  });

  it("submitting the create form creates the preset and navigates to its detail page", async () => {
    render(PresetsList);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText("Example: Pantry staples"), "Snacks");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await vi.waitFor(() => {
      expect(groceryPresets.all.map((p) => p.name)).toContain("Snacks");
    });
    const created = groceryPresets.all.find((p) => p.name === "Snacks")!;
    expect(router.current).toEqual({ name: "preset", id: created.id });
  });

  it("clicking a list item navigates to its detail page", async () => {
    const preset = await seedPreset({ name: "Pantry staples" });
    render(PresetsList);
    const user = userEvent.setup();

    await user.click(screen.getByText("Pantry staples"));

    expect(router.current).toEqual({ name: "preset", id: preset.id });
  });

  it("delete is two-step: first click arms confirm/cancel, second click deletes", async () => {
    const preset = await seedPreset({ name: "Pantry staples" });
    render(PresetsList);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete preset" }));

    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(groceryPresets.all.some((p) => p.id === preset.id)).toBe(true);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await vi.waitFor(() => {
      expect(groceryPresets.all.some((p) => p.id === preset.id)).toBe(false);
    });
  });

  it("clicking Cancel in the confirm step keeps the preset", async () => {
    const preset = await seedPreset({ name: "Pantry staples" });
    render(PresetsList);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete preset" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete preset" })).toBeInTheDocument();
    expect(groceryPresets.all.some((p) => p.id === preset.id)).toBe(true);
  });
});
