import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, userEvent, resetDb, resetStores } from "../componentTestUtils";
import PresetDetail from "../../routes/presets/[id]/PresetDetail.svelte";
import { groceryPresets } from "../../lib/stores/groceryPresets.svelte";
import { groceryPresetRepo } from "../../lib/repos/groceryPresetRepo";
import { db } from "../../lib/db";
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

describe("PresetDetail", () => {
  beforeEach(async () => {
    await resetDb();
    resetStores();
  });

  it("renders the not-found state for an unknown id", () => {
    render(PresetDetail, { id: "missing" });
    expect(screen.getByText("Preset not found.")).toBeInTheDocument();
  });

  it("pre-fills the name and ingredients from the preset", async () => {
    const preset = await seedPreset({ name: "Pantry staples" });
    render(PresetDetail, { id: preset.id });

    expect((screen.getByLabelText("Preset name") as HTMLInputElement).value).toBe("Pantry staples");
    expect(screen.getByText("Rice")).toBeInTheDocument();
  });

  it("blocks save with a blank name", async () => {
    const preset = await seedPreset();
    render(PresetDetail, { id: preset.id });
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("Preset name"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByText("Please enter a preset name.")).toBeInTheDocument();
  });

  // Order matters here: `hasNavigatedInApp()` is a module-level flag that only
  // ever flips false -> true, so the "no in-app history" case must run before
  // any test in this file triggers a `navigate()` call (see MealDetail.test.ts).
  it("Back navigates to /presets when there is no in-app navigation history", async () => {
    const preset = await seedPreset();
    render(PresetDetail, { id: preset.id });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "← Back to presets" }));

    expect(router.current).toEqual({ name: "presets" });
  });

  it("Save persists the name and items and returns via browser history", async () => {
    const preset = await seedPreset({ name: "Pantry staples" });
    const backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {});
    render(PresetDetail, { id: preset.id });
    const user = userEvent.setup();

    const nameInput = screen.getByLabelText("Preset name") as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, "Baking staples");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await vi.waitFor(() => expect(backSpy).toHaveBeenCalled());
    const saved = await db.groceryPresets.get(preset.id);
    expect(saved?.name).toBe("Baking staples");
    expect(saved?.items).toEqual([{ name: "Rice", quantity: "1", category: "aisle" }]);
    backSpy.mockRestore();
  });

  it("Cancel discards changes and returns via browser history", async () => {
    const preset = await seedPreset({ name: "Pantry staples" });
    const backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {});
    render(PresetDetail, { id: preset.id });
    const user = userEvent.setup();

    const nameInput = screen.getByLabelText("Preset name") as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, "Changed name");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(backSpy).toHaveBeenCalled();
    const saved = await db.groceryPresets.get(preset.id);
    expect(saved?.name).toBe("Pantry staples");
    backSpy.mockRestore();
  });
});
