import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, userEvent, resetDb, resetStores } from "../componentTestUtils";
import MealIdeas from "../../routes/meal-ideas/MealIdeas.svelte";
import { mealIdeas } from "../../lib/stores/mealIdeas.svelte";
import { mealIdeaRepo } from "../../lib/repos/mealIdeaRepo";

async function seedIdea(text: string): Promise<void> {
  await mealIdeaRepo.create(text);
  mealIdeas.all = await mealIdeaRepo.getAll();
}

describe("MealIdeas", () => {
  beforeEach(async () => {
    await resetDb();
    resetStores();
  });

  it("shows the empty state when there are no ideas", () => {
    render(MealIdeas);
    expect(screen.getByText("No ideas yet. Add a link or a note above.")).toBeInTheDocument();
  });

  it("adds an idea via the textarea and renders it as a row", async () => {
    render(MealIdeas);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText("Paste a link or jot an idea…"), "Batch cook chili");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await vi.waitFor(() => {
      expect(mealIdeas.all.map((i) => i.text)).toContain("Batch cook chili");
    });
    expect(screen.getByRole("button", { name: "Batch cook chili" })).toBeInTheDocument();
  });

  it("tap-to-edit a row and save updates the text", async () => {
    await seedIdea("Draft idea");
    render(MealIdeas);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Draft idea" }));

    const editor = screen.getByRole("textbox", { name: "Edit idea" });
    await user.clear(editor);
    await user.type(editor, "Polished idea");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await vi.waitFor(() => {
      expect(mealIdeas.all[0]!.text).toBe("Polished idea");
    });
    expect(screen.getByRole("button", { name: "Polished idea" })).toBeInTheDocument();
  });

  it("deletes an idea immediately on the trash icon with no confirm step", async () => {
    await seedIdea("Ephemeral");
    render(MealIdeas);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete idea" }));

    await vi.waitFor(() => {
      expect(mealIdeas.all).toHaveLength(0);
    });
    expect(screen.getByText("No ideas yet. Add a link or a note above.")).toBeInTheDocument();
  });

  it("renders a URL inside the text as a tappable link", async () => {
    await seedIdea("Recipe here https://example.com/shakshuka to try");
    render(MealIdeas);

    const link = screen.getByRole("link", { name: "https://example.com/shakshuka" });
    expect(link).toHaveAttribute("href", "https://example.com/shakshuka");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
