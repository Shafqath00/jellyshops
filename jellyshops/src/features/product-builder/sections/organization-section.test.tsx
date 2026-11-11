import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { emptyDraft } from "../draft";
import { OrganizationSection } from "./organization-section";

vi.mock("@/features/admin/api/catalog-api", () => {
  const all = vi.fn(async () => [{ id: "summer", title: "Summer" }, { id: "gifts", title: "Gifts" }]);
  return { useAdminCatalog: () => ({ all, ready: true, storeId: "s" }) };
});

function Harness() {
  const [draft, setDraft] = useState({ ...emptyDraft, collectionIds: ["summer"] });
  return <><OrganizationSection draft={draft} onChange={(field, value) => setDraft(current => ({ ...current, [field]: value }))} /><output aria-label="Selected collections">{draft.collectionIds.join(",")}</output></>;
}

describe("product organization", () => {
  it("filters collections without losing selections hidden by the search", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(await screen.findByRole("checkbox", { name: "Summer" })).toBeChecked();
    await user.type(screen.getByRole("searchbox", { name: "Search collections" }), "Gift");
    expect(screen.queryByRole("checkbox", { name: "Summer" })).toBeNull();
    await user.click(screen.getByRole("checkbox", { name: "Gifts" }));
    expect(screen.getByLabelText("Selected collections")).toHaveTextContent("summer,gifts");
    await user.clear(screen.getByRole("searchbox", { name: "Search collections" }));
    expect(screen.getByRole("checkbox", { name: "Summer" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Gifts" })).toBeChecked();
  });
});
