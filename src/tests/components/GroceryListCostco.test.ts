import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, userEvent, resetDb, resetStores } from "../componentTestUtils";
import GroceryList from "../../lib/components/GroceryList.svelte";
import { groceryList, addGroceryItem } from "../../lib/stores/groceryList.svelte";
import { groceryPresetRepo } from "../../lib/repos/groceryPresetRepo";

describe("GroceryList Costco section", () => {
  beforeEach(async () => {
    await resetDb();
    resetStores();
  });

  it("offers an enable button and no section by default", () => {
    render(GroceryList);
    expect(screen.getByRole("button", { name: "Add Costco section" })).toBeInTheDocument();
    expect(screen.queryByTestId("costco-section")).not.toBeInTheDocument();
  });

  it("enabling seeds recurring items into a flat Costco section", async () => {
    const list = await groceryPresetRepo.getCostcoList();
    await groceryPresetRepo.update(list.id, {
      name: list.name,
      items: [{ name: "Paper towels", quantity: "1", category: "aisle" }],
    });
    render(GroceryList);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Add Costco section" }));

    const section = await screen.findByTestId("costco-section");
    await vi.waitFor(() => expect(within(section).getByText("Paper towels")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Add Costco section" })).not.toBeInTheDocument();
    // Not duplicated into the "Aisles" category group.
    expect(screen.getAllByText("Paper towels")).toHaveLength(1);
  });

  it("adds, checks and removes a Costco item", async () => {
    render(GroceryList);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Add Costco section" }));
    const section = await screen.findByTestId("costco-section");

    await user.click(within(section).getByRole("button", { name: "Add Costco item" }));
    await user.type(screen.getByPlaceholderText("Ingredient name"), "Salmon");
    await user.type(screen.getByPlaceholderText("Qty"), "2 kg");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await vi.waitFor(() => expect(within(section).getByText("Salmon")).toBeInTheDocument());

    await user.click(within(within(section).getByText("Salmon").closest("li")!).getByRole("checkbox"));
    await vi.waitFor(() =>
      expect(groceryList.itemsForWeek.find((i) => i.name === "Salmon")?.checked).toBe(true),
    );

    await user.click(
      within(within(section).getByText("Salmon").closest("li")!).getByRole("button", { name: "Remove from list" }),
    );
    await vi.waitFor(() => expect(within(section).queryByText("Salmon")).not.toBeInTheDocument());
  });

  it("removing the section asks for in-page confirmation, then deletes it", async () => {
    render(GroceryList);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Add Costco section" }));
    const section = await screen.findByTestId("costco-section");

    await user.click(within(section).getByRole("button", { name: "Remove Costco section" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(groceryList.costcoEnabled).toBe(true);

    await user.click(screen.getByRole("button", { name: "Remove" }));
    await vi.waitFor(() => expect(screen.queryByTestId("costco-section")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Add Costco section" })).toBeInTheDocument();
  });

  it("a Costco item sharing a regular item's name stays in its own section", async () => {
    await addGroceryItem("aisle", "Rice", "1");
    render(GroceryList);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Add Costco section" }));
    const section = await screen.findByTestId("costco-section");
    await user.click(within(section).getByRole("button", { name: "Add Costco item" }));
    await user.type(screen.getByPlaceholderText("Ingredient name"), "Rice");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await vi.waitFor(() => expect(within(section).getByText("Rice")).toBeInTheDocument());
    expect(screen.getAllByText("Rice")).toHaveLength(2);
  });
});
