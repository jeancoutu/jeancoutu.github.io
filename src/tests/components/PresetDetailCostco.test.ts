import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, userEvent, resetDb, resetStores } from "../componentTestUtils";
import PresetDetail from "../../routes/presets/[id]/PresetDetail.svelte";
import { groceryPresets, ensureCostcoPreset } from "../../lib/stores/groceryPresets.svelte";
import { groceryPresetRepo } from "../../lib/repos/groceryPresetRepo";

describe("PresetDetail for the Costco recurring list", () => {
  beforeEach(async () => {
    await resetDb();
    resetStores();
  });

  it("opens the Costco list without a name field and with no delete action", async () => {
    const list = await ensureCostcoPreset();
    render(PresetDetail, { id: list.id });

    expect(screen.getByRole("heading", { name: "Costco recurring items" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Preset name")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("saves edits to the Costco list while keeping it out of the regular presets", async () => {
    const list = await ensureCostcoPreset();
    await groceryPresetRepo.update(list.id, {
      name: list.name,
      items: [{ name: "Eggs", quantity: "24", category: "fridge" }],
    });
    groceryPresets.costco = (await groceryPresetRepo.findCostcoList()) ?? null;
    render(PresetDetail, { id: list.id });
    const user = userEvent.setup();

    expect(screen.getByText("Eggs")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await vi.waitFor(() => expect(groceryPresets.costco?.items.map((i) => i.name)).toEqual(["Eggs"]));
    expect(groceryPresets.all).toEqual([]);
  });
});
